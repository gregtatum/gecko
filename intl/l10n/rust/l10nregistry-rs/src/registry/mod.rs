mod asynchronous;
mod synchronous;

use std::{collections::HashSet, rc::Rc, sync::Mutex, sync::MutexGuard};

use crate::errors::L10nRegistrySetupError;
use crate::source::{FileSource, ResourceId};

use crate::env::ErrorReporter;
use crate::fluent::FluentBundle;
use fluent_bundle::FluentResource;
use fluent_fallback::generator::BundleGenerator;
use unic_langid::LanguageIdentifier;

pub use asynchronous::GenerateBundles;
pub use synchronous::GenerateBundlesSync;

pub type FluentResourceSet = Vec<Rc<FluentResource>>;

/// The shared information that makes up the configuration for the L10nRegistry.
#[derive(Default)]
struct Shared<P, B> {
    metasources: Mutex<Vec<Vec<FileSource>>>,
    provider: P,
    bundle_adapter: Option<B>,
}

/// A locked version of the [L10nRegistry]. This is used to access the [FileSource] and
/// can be obtained via the [L10nRegistry::lock] method.
pub struct L10nRegistryLocked<'a, B> {
    metasources: MutexGuard<'a, Vec<Vec<FileSource>>>,
    bundle_adapter: Option<&'a B>,
}

impl<'a, B> L10nRegistryLocked<'a, B> {
    /// Iterate over the FileSources for a metasource.
    pub fn iter(&self, metasource_idx: usize) -> impl Iterator<Item = &FileSource> {
        self.metasource(metasource_idx).iter()
    }

    /// Get a metasource by index, but provide a nice error message if the index
    /// is out of bounds.
    pub fn metasource(&self, metasource_idx: usize) -> &Vec<FileSource> {
        if let Some(metasource) = self.metasources.get(metasource_idx) {
            return &metasource;
        }
        panic!(
            "Metasource index of {} is out of range of the list of {} meta sources.",
            metasource_idx,
            self.metasources.len()
        );
    }

    /// Get a [FileSource] from a metasource, but provide a nice error message if the
    /// index is out of bounds.
    pub fn filesource(&self, metasource_idx: usize, filesource_idx: usize) -> &FileSource {
        let metasource = self.metasource(metasource_idx);
        let reversed_idx = metasource.len() - 1 - filesource_idx;
        if let Some(file_source) = metasource.get(reversed_idx) {
            return file_source;
        }
        panic!(
            "File source index of {} is out of range of the list of {} file sources.",
            filesource_idx,
            metasource.len()
        );
    }

    /// Get a [FileSource] by name from a metasource. This is useful for testing.
    #[cfg(test)]
    pub fn file_source_by_name(&self, metasource_idx: usize, name: &str) -> Option<&FileSource> {
        self.iter(metasource_idx)
            .find(|&source| source.name == name)
    }

    pub fn generate_sources_for_file<'l>(
        &'l self,
        metasource: usize,
        langid: &'l LanguageIdentifier,
        resource_id: &'l ResourceId,
    ) -> impl Iterator<Item = &FileSource> {
        self.iter(metasource)
            .filter(move |source| source.has_file(langid, resource_id) != Some(false))
    }
}

/// The [BundleAdapter] can adapt the bundle to the environment with such actions as
/// setting the platform, and hooking up functions such as Fluent's DATETIME and
/// NUMBER formatting functions.
pub trait BundleAdapter {
    fn adapt_bundle(&self, bundle: &mut FluentBundle);
}

/// The L10nRegistry contains a list of metasources, which each contain a list of
/// FileSources. This metasources data can be accessed on multiple threads, and is
/// protected behind a mutex. The [L10nRegistryLocked] struct is a variant of this
/// struct that allows scoped access to the registry.
///
/// `P` - A provider
/// `B` - A bundle adaptor
#[derive(Clone)]
pub struct L10nRegistry<P, B> {
    shared: Rc<Shared<P, B>>,
}

impl<P, B> L10nRegistry<P, B> {
    /// Create a new [L10nRegistry] from a provider.
    pub fn with_provider(provider: P) -> Self {
        Self {
            shared: Rc::new(Shared {
                metasources: Default::default(),
                provider,
                bundle_adapter: None,
            }),
        }
    }

    /// Set the bundle adaptor. See [BundleAdapter] for more information.
    pub fn set_bundle_adaptor(&mut self, bundle_adapter: B) -> Result<(), L10nRegistrySetupError>
    where
        B: BundleAdapter,
    {
        let shared = Rc::get_mut(&mut self.shared).ok_or(L10nRegistrySetupError::RegistryLocked)?;
        shared.bundle_adapter = Some(bundle_adapter);
        Ok(())
    }

    /// Creates a locked version of the registry that can be manipulated.
    pub fn lock(&self) -> L10nRegistryLocked<'_, B> {
        L10nRegistryLocked {
            // The lock() method only fails here if another thread has panicked
            // while holding the lock. In this case, we'll propagate the panic
            // as well. It's not clear what the recovery strategy would be for
            // us to deal with a panic in another thread.
            metasources: self
                .shared
                .metasources
                .lock()
                .expect("Deadlock due to crashed thread holding a lock."),
            bundle_adapter: self.shared.bundle_adapter.as_ref(),
        }
    }

    fn try_lock_metasources(
        &self,
    ) -> Result<MutexGuard<Vec<Vec<FileSource>>>, L10nRegistrySetupError> {
        self.shared
            .metasources
            .try_lock()
            .map_err(|_| L10nRegistrySetupError::RegistryLocked)
    }

    /// Adds a new FileSource to the registry and to its appropriate metasource. If the
    /// metasource for this FileSource does not exist, then it is created.
    pub fn register_sources(
        &self,
        new_sources: Vec<FileSource>,
    ) -> Result<(), L10nRegistrySetupError> {
        let mut metasources = self.try_lock_metasources()?;

        for new_source in new_sources {
            if let Some(metasource) = metasources
                .iter_mut()
                .find(|source| source[0].metasource == new_source.metasource)
            {
                metasource.push(new_source);
            } else {
                metasources.push(vec![new_source]);
            }
        }
        Ok(())
    }

    /// Update the information about sources already stored in the registry. Each
    /// [FileSource] provided must exist, or else a [L10nRegistrySetupError] will
    /// be returned.
    pub fn update_sources(
        &self,
        new_sources: Vec<FileSource>,
    ) -> Result<(), L10nRegistrySetupError> {
        let mut metasources = self.try_lock_metasources()?;

        for new_source in new_sources {
            if let Some(metasource) = metasources
                .iter_mut()
                .find(|source| source[0].metasource == new_source.metasource)
            {
                if let Some(idx) = metasource.iter().position(|source| *source == new_source) {
                    *metasource.get_mut(idx).unwrap() = new_source;
                } else {
                    return Err(L10nRegistrySetupError::MissingSource {
                        name: new_source.name,
                    });
                }
            }
        }
        Ok(())
    }

    /// Remove the provided sources. If a metasource becomes empty after this operation,
    /// the metasource is also removed.
    pub fn remove_sources<S>(&self, del_sources: Vec<S>) -> Result<(), L10nRegistrySetupError>
    where
        S: ToString,
    {
        let mut metasources = self.try_lock_metasources()?;
        let del_sources: Vec<String> = del_sources.into_iter().map(|s| s.to_string()).collect();

        for metasource in metasources.iter_mut() {
            metasource.retain(|source| !del_sources.contains(&source.name));
        }

        metasources.retain(|metasource| !metasource.is_empty());

        Ok(())
    }

    pub fn clear_sources(&self) -> Result<(), L10nRegistrySetupError> {
        let mut metasources = self.try_lock_metasources()?;
        metasources.clear();
        Ok(())
    }

    pub fn get_source_names(&self) -> Result<Vec<String>, L10nRegistrySetupError> {
        Ok(self
            .try_lock_metasources()?
            .iter()
            .flatten()
            .map(|s| s.name.clone())
            .collect())
    }

    pub fn has_source(&self, name: &str) -> Result<bool, L10nRegistrySetupError> {
        Ok(self
            .try_lock_metasources()?
            .iter()
            .flatten()
            .any(|source| source.name == name))
    }

    pub fn get_source(&self, name: &str) -> Result<Option<FileSource>, L10nRegistrySetupError> {
        Ok(self
            .try_lock_metasources()?
            .iter()
            .flatten()
            .find(|source| source.name == name)
            .cloned())
    }

    pub fn get_available_locales(&self) -> Result<Vec<LanguageIdentifier>, L10nRegistrySetupError> {
        let metasources = self.try_lock_metasources()?;
        let mut result = HashSet::new();
        for source in metasources.iter().flatten() {
            for locale in source.locales() {
                result.insert(locale);
            }
        }
        Ok(result.into_iter().map(|l| l.to_owned()).collect())
    }
}

impl<P, B> BundleGenerator for L10nRegistry<P, B>
where
    P: ErrorReporter + Clone,
    B: BundleAdapter + Clone,
{
    type Resource = Rc<FluentResource>;
    type Iter = GenerateBundlesSync<P, B>;
    type Stream = GenerateBundles<P, B>;
    type LocalesIter = std::vec::IntoIter<LanguageIdentifier>;

    fn bundles_iter(
        &self,
        locales: Self::LocalesIter,
        resource_ids: Vec<ResourceId>,
    ) -> Self::Iter {
        let resource_ids = resource_ids.into_iter().collect();
        self.generate_bundles_sync(locales, resource_ids)
    }

    fn bundles_stream(
        &self,
        locales: Self::LocalesIter,
        resource_ids: Vec<ResourceId>,
    ) -> Self::Stream {
        let resource_ids = resource_ids.into_iter().collect();
        self.generate_bundles(locales, resource_ids)
    }
}
