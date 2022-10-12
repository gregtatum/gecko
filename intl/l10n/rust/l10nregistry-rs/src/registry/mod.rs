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

/// The shared information that makes up the configuration the L10nRegistry. It is
/// broken out into a separate struct so that it can be shared via an Rc pointer.
#[derive(Default)]
struct Shared<P, B> {
    /// The raw mutex lock for the MetaSources.
    metasources_mutex: Mutex<Vec<Vec<FileSource>>>,
    provider: P,
    bundle_adapter: Option<B>,
}

/// MetaSources can be obtained from multiple threads. This struct provides locked
/// access for working with metasources and their FileSources. Each MetaSource
/// contains a list of FileSources.
pub struct MetaSources<'a>(MutexGuard<'a, Vec<Vec<FileSource>>>);

impl<'a> MetaSources<'a> {
    /// Iterate over all FileSources in all MetaSources.
    pub fn filesources(&self) -> impl Iterator<Item = &FileSource> {
        self.0.iter().flatten()
    }

    /// Iterate over all FileSources in all MetaSources.
    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut Vec<FileSource>> {
        self.0.iter_mut()
    }

    /// The number of metasources.
    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// If there are no metasources.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Clears out all metasources.
    pub fn clear(&mut self) {
        self.0.clear();
    }

    /// Clears out only empty metasources.
    pub fn clear_empty_metasources(&mut self) {
        self.0.retain(|metasource| !metasource.is_empty());
    }

    /// Adds a [FileSource] to its appropriate metasource.
    pub fn add_filesource(&mut self, new_source: FileSource) {
        if let Some(metasource) = self
            .0
            .iter_mut()
            .find(|source| source[0].metasource == new_source.metasource)
        {
            // A metasource was found, add to the existing one.
            metasource.push(new_source);
        } else {
            // Create a new metasource.
            self.0.push(vec![new_source]);
        }
    }

    /// Adds a [FileSource] to its appropriate metasource.
    pub fn update_filesource(&mut self, new_source: &FileSource) -> bool {
        if let Some(metasource) = self
            .0
            .iter_mut()
            .find(|source| source[0].metasource == new_source.metasource)
        {
            if let Some(idx) = metasource.iter().position(|source| *source == *new_source) {
                *metasource.get_mut(idx).unwrap() = new_source.clone();
                return true;
            }
        }
        false
    }

    /// Get a metasource by index, but provide a nice error message if the index
    /// is out of bounds.
    pub fn metasource(&self, metasource_idx: usize) -> &Vec<FileSource> {
        if let Some(metasource) = self.0.get(metasource_idx) {
            return &metasource;
        }
        panic!(
            "Metasource index of {} is out of range of the list of {} meta sources.",
            metasource_idx,
            self.0.len()
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
        self.metasource(metasource_idx)
            .iter()
            .find(|&source| source.name == name)
    }

    /// Get the list of [FileSource]s for a given langid and
    #[cfg(test)]
    pub fn get_sources_for_resource<'l>(
        &'l self,
        metasource_idx: usize,
        langid: &'l LanguageIdentifier,
        resource_id: &'l ResourceId,
    ) -> impl Iterator<Item = &FileSource> {
        self.metasource(metasource_idx)
            .iter()
            .filter(move |source| source.has_file(langid, resource_id) != Some(false))
    }
}

/// The [BundleAdapter] can adapt the bundle to the environment with such actions as
/// setting the platform, and hooking up functions such as Fluent's DATETIME and
/// NUMBER formatting functions.
pub trait BundleAdapter {
    fn adapt_bundle(&self, bundle: &mut FluentBundle);
}

/// The L10nRegistry is the main struct for owning the registry information.
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
                metasources_mutex: Default::default(),
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

    /// Creates a locked version of the MetaSources that can read.
    pub fn metasources(&self) -> MetaSources<'_> {
        MetaSources(
            // The lock() method only fails here if another thread has panicked
            // while holding the lock. In this case, we'll propagate the panic
            // as well. It's not clear what the recovery strategy would be for
            // us to deal with a panic in another thread.
            self.shared
                .metasources_mutex
                .lock()
                .expect("Deadlock most likely due to a crashed thread holding a lock."),
        )
    }

    fn try_lock_metasources(&self) -> Result<MetaSources, L10nRegistrySetupError> {
        match self.shared.metasources_mutex.try_lock() {
            Ok(metasources) => Ok(MetaSources(metasources)),
            Err(_) => Err(L10nRegistrySetupError::RegistryLocked),
        }
    }

    /// Adds a new FileSource to the registry and to its appropriate metasource. If the
    /// metasource for this FileSource does not exist, then it is created.
    pub fn register_sources(
        &self,
        new_sources: Vec<FileSource>,
    ) -> Result<(), L10nRegistrySetupError> {
        let mut metasources = self.try_lock_metasources()?;
        for new_source in new_sources {
            metasources.add_filesource(new_source);
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
            if !metasources.update_filesource(&new_source) {
                return Err(L10nRegistrySetupError::MissingSource {
                    name: new_source.name,
                });
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

        metasources.clear_empty_metasources();

        Ok(())
    }

    /// Clears out all metasources and sources.
    pub fn clear_sources(&self) -> Result<(), L10nRegistrySetupError> {
        self.try_lock_metasources()?.clear();
        Ok(())
    }

    /// Flattens out all metasources and returns the complete list of source names.
    pub fn get_source_names(&self) -> Result<Vec<String>, L10nRegistrySetupError> {
        Ok(self
            .try_lock_metasources()?
            .filesources()
            .map(|s| s.name.clone())
            .collect())
    }

    /// Checks if any metasources has a source, by the name.
    pub fn has_source(&self, name: &str) -> Result<bool, L10nRegistrySetupError> {
        Ok(self
            .try_lock_metasources()?
            .filesources()
            .any(|source| source.name == name))
    }

    /// Gets a source by the name, from any metasource.
    pub fn get_source(&self, name: &str) -> Result<Option<FileSource>, L10nRegistrySetupError> {
        Ok(self
            .try_lock_metasources()?
            .filesources()
            .find(|source| source.name == name)
            .cloned())
    }

    /// Returns a unique list of locale names from all sources.
    pub fn get_available_locales(&self) -> Result<Vec<LanguageIdentifier>, L10nRegistrySetupError> {
        let metasources = self.try_lock_metasources()?;
        let mut result = HashSet::new();
        for source in metasources.filesources() {
            for locale in source.locales() {
                result.insert(locale);
            }
        }
        Ok(result.into_iter().map(|l| l.to_owned()).collect())
    }
}

/// Defines how to generate bundles synchronously and asynchronously.
impl<P, B> BundleGenerator for L10nRegistry<P, B>
where
    P: ErrorReporter + Clone,
    B: BundleAdapter + Clone,
{
    type Resource = Rc<FluentResource>;
    type Iter = GenerateBundlesSync<P, B>;
    type Stream = GenerateBundles<P, B>;
    type LocalesIter = std::vec::IntoIter<LanguageIdentifier>;

    /// The synchronous version of the bundle generator.
    fn bundles_iter(
        &self,
        locales: Self::LocalesIter,
        resource_ids: Vec<ResourceId>,
    ) -> Self::Iter {
        let resource_ids = resource_ids.into_iter().collect();
        self.generate_bundles_sync(locales, resource_ids)
    }

    /// The asynchronous version of the bundle generator.
    fn bundles_stream(
        &self,
        locales: Self::LocalesIter,
        resource_ids: Vec<ResourceId>,
    ) -> Self::Stream {
        let resource_ids = resource_ids.into_iter().collect();
        self.generate_bundles(locales, resource_ids)
    }
}
