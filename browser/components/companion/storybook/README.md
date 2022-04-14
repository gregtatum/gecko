= Storybook for Flowstate

Storybook is a component library to document our design system, reusable
components and any specific components you might want to test with dummy data.

== Background

Changes to preprocessed files like common.inc.css will still require a mach
build faster, but files that are directly accessed should be updated
automatically, or after a refresh.

Tested on macOS only.

== Running Storybook

The `storybook` npm script will start storybook and launch your local build
with storybook open (may need a refresh if browser startup was faster than
storybook).

There are a few ways you can run this script.

=== `start-storybook` script

The `start-storybook` script will use the mach npm to install and run storybook.
This could be handy if you're unfamiliar with npm but it might not provide all
the flexibility you'd like if you're comfortable with npm.

```
cd browser/components/companion/storybook
./start-storybook
```

=== Global npm

You can use a global `npm` to install and run storyboook. This seems to work
fine on macOS Monterey.

```
cd browser/components/companion/storybook
npm install
npm run storybook
```

=== Mach npm from root

You could tell your mach command which npm folder to use from your project root.

```
./mach npm --prefix=browser/components/companion/storybook install
./mach npm --prefix=browser/components/companion/storybook run storybook
```

It might be handy to alias this in your shell.

```
alias npm-storybook='./mach npm --prefix=browser/components/companion/storybook'
```
