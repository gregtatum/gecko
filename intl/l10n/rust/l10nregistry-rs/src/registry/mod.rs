mod asynchronous;
mod synchronous;

use std::cell::RefCell;
use std::{collections::HashSet, rc::Rc};

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

/// The L10nRegistry has a shareable component that is placed behind an Rc pointer.
/// If this pointer is unique, then the contents of the L10nRegistry are free
/// to be mutated. However, if there are multiple copies of this pointer, then
/// mutations are deferred in the pending_mutations vector. This acts as a locking
/// mechanism so that the contents are not mutated while they are being iterated over.
pub struct ShareableL10nRegistry<P, B> {
    /// The raw mutex lock for the MetaSources.
    metasources: MetaSources,
    provider: P,
    bundle_adapter: Option<B>,
}

/// TODO before landing - write docs.
#[derive(Default)]
pub struct MetaSources(Vec<Vec<FileSource>>);

impl MetaSources {
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

    /// Get an iterator for the [FileSource]s that match the [LanguageIdentifier]
    /// and [ResourceId].
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

pub enum RegistryMutations {
    RegisterSources(Vec<FileSource>),
    UpdateSources(Vec<FileSource>),
    RemoveSources(Vec<String>),
    ClearSources,
}

/// The L10nRegistry is the main struct for owning the registry information.
///
/// `P` - A provider
/// `B` - A bundle adaptor
pub struct L10nRegistry<P, B> {
    shareable: RefCell<Rc<ShareableL10nRegistry<P, B>>>,

    /// It's possible there are outstanding references to the [MetaSources] in
    /// the async iterators, so defer mutations until it is safe to mutate
    /// the [MetaSources].
    pending_mutations: RefCell<Vec<RegistryMutations>>,
}

impl<P, B> L10nRegistry<P, B> {
    /// Create a new [L10nRegistry] from a provider.
    pub fn with_provider(provider: P) -> Self {
        Self {
            shareable: RefCell::new(Rc::new(ShareableL10nRegistry {
                metasources: Default::default(),
                provider,
                bundle_adapter: None,
            })),
            pending_mutations: RefCell::new(Vec::new()),
        }
    }

    /// Set the bundle adaptor. See [BundleAdapter] for more information.
    pub fn set_bundle_adaptor(&self, bundle_adapter: B) -> Result<(), L10nRegistrySetupError>
    where
        B: BundleAdapter,
    {
        if let Some(shared) = Rc::get_mut(&mut self.shareable.borrow_mut()) {
            shared.bundle_adapter = Some(bundle_adapter);
            Ok(())
        } else {
            Err(L10nRegistrySetupError::RegistryLocked)
        }
    }

    /// Adds a new FileSource to the registry and to its appropriate metasource. If the
    /// metasource for this FileSource does not exist, then it is created.
    pub fn register_sources(&self, new_sources: Vec<FileSource>) {
        if let Some(shared) = Rc::get_mut(&mut self.shareable.borrow_mut()) {
            for new_source in new_sources {
                shared.metasources.add_filesource(new_source);
            }
        } else {
            self.pending_mutations
                .borrow_mut()
                .push(RegistryMutations::RegisterSources(new_sources));
        }
    }

    /// Update the information about sources already stored in the registry. Each
    /// [FileSource] provided must exist, or else a [L10nRegistrySetupError] will
    /// be returned.
    pub fn update_sources(
        &self,
        new_sources: Vec<FileSource>,
    ) -> Result<(), L10nRegistrySetupError> {
        if let Some(shared) = Rc::get_mut(&mut self.shareable.borrow_mut()) {
            for new_source in new_sources {
                if !shared.metasources.update_filesource(&new_source) {
                    return Err(L10nRegistrySetupError::MissingSource {
                        name: new_source.name,
                    });
                }
            }
        } else {
            self.pending_mutations
                .borrow_mut()
                .push(RegistryMutations::UpdateSources(new_sources));
        }
        Ok(())
    }

    /// Remove the provided sources. If a metasource becomes empty after this operation,
    /// the metasource is also removed.
    pub fn remove_sources<S>(&self, del_sources: Vec<S>)
    where
        S: ToString,
    {
        let del_sources: Vec<String> = del_sources.into_iter().map(|s| s.to_string()).collect();

        if let Some(shared) = Rc::get_mut(&mut self.shareable.borrow_mut()) {
            for metasource in shared.metasources.iter_mut() {
                metasource.retain(|source| !del_sources.contains(&source.name));
            }

            shared.metasources.clear_empty_metasources();
        } else {
            self.pending_mutations
                .borrow_mut()
                .push(RegistryMutations::RemoveSources(del_sources));
        }
    }

    /// Clears out all metasources and sources.
    pub fn clear_sources(&self) {
        if let Some(shared) = Rc::get_mut(&mut self.shareable.borrow_mut()) {
            shared.metasources.clear();
        } else {
            self.pending_mutations
                .borrow_mut()
                .push(RegistryMutations::ClearSources);
        }
    }

    /// Flattens out all metasources and returns the complete list of source names.
    pub fn get_source_names(&self) -> Result<Vec<String>, L10nRegistrySetupError> {
        Ok(self
            .shareable
            .borrow()
            .metasources
            .filesources()
            .map(|s| s.name.clone())
            .collect())
    }

    /// Checks if any metasources has a source, by the name.
    pub fn has_source(&self, name: &str) -> Result<bool, L10nRegistrySetupError> {
        Ok(self
            .shareable
            .borrow()
            .metasources
            .filesources()
            .any(|source| source.name == name))
    }

    /// Gets a source by the name, from any metasource.
    pub fn get_source(&self, name: &str) -> Result<Option<FileSource>, L10nRegistrySetupError> {
        Ok(self
            .shareable
            .borrow()
            .metasources
            .filesources()
            .find(|source| source.name == name)
            .cloned())
    }

    /// Returns a unique list of locale names from all sources.
    pub fn get_available_locales(&self) -> Result<Vec<LanguageIdentifier>, L10nRegistrySetupError> {
        let mut result = HashSet::new();
        let shareable = self.shareable.borrow();
        for source in shareable.metasources.filesources() {
            for locale in source.locales() {
                result.insert(locale);
            }
        }
        Ok(result.into_iter().map(|l| l.to_owned()).collect())
    }

    /// Borrow the contents of the L10nRegistry, which locks it down so that any
    /// mutations to the registry are deferred until there are no additional references.
    pub fn borrow(&self) -> Rc<ShareableL10nRegistry<P, B>> {
        // Ensure any deferred mutations are applied before sharing.
        self.apply_mutations();
        self.shareable.borrow().clone()
    }

    /// It's possible to have async iterators over the metasources that have not resolved
    /// while trying to mutate the metasources list. When this happens the mutations
    /// are stored to be applied at a later time.
    fn apply_mutations(&self) {
        if self.pending_mutations.borrow().is_empty() {
            // There is nothing to apply.
            return;
        }

        if Rc::get_mut(&mut self.shareable.borrow_mut()).is_none() {
            // The metasources are not available to update. It's possible this means
            // we'll continue using stale information, but async iterators could still
            // be iterating over the old sources. Defer the updates until it is safe
            // to apply them.
            return;
        }

        // Actually applied the pending mutations.
        for mutation in self.pending_mutations.take().drain(..) {
            match mutation {
                RegistryMutations::RegisterSources(sources) => self.register_sources(sources),
                RegistryMutations::UpdateSources(sources) => {
                    if let Err(_) = self.update_sources(sources) {
                        // The common case is that this would be reported by the initial
                        // calling function, but this update was deferred. Go ahead and
                        // print the error to stderr so that the error isn't completely
                        // lost.
                        eprintln!(
                            "An invalid source was provided for updating in the L10nRegistry."
                        );
                    }
                }
                RegistryMutations::RemoveSources(sources) => self.remove_sources(sources),
                RegistryMutations::ClearSources => self.clear_sources(),
            }
        }
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

    /// The synchronous version of the bundle generator. This is hooked into Gecko
    /// code via the `l10nregistry_generate_bundles_sync` function.
    fn bundles_iter(
        &self,
        locales: Self::LocalesIter,
        resource_ids: Vec<ResourceId>,
    ) -> Self::Iter {
        let resource_ids = resource_ids.into_iter().collect();
        self.generate_bundles_sync(locales, resource_ids)
    }

    /// The asynchronous version of the bundle generator. This is hooked into Gecko
    /// code via the `l10nregistry_generate_bundles` function.
    fn bundles_stream(
        &self,
        locales: Self::LocalesIter,
        resource_ids: Vec<ResourceId>,
    ) -> Self::Stream {
        let resource_ids = resource_ids.into_iter().collect();
        self.generate_bundles(locales, resource_ids)
    }
}
