#!/usr/bin/env node
const _ = require('lodash')
const Dependencies = require('./dependencies')
const minimatch = require('minimatch')
const Promise = require('bluebird')
const request = require('request-promise')
const { resolve } = require('path')
const semver = require('semver')

const stat = Promise.promisify(require('fs').stat)
const glob = Promise.promisify(require('glob'))

const {
  _: commands,
  dependencyNamePattern,
  registryUrl = 'https://registry.npmjs.org',
  user,
  pass
} = require('yargs').argv

const deps = new Dependencies(dependencyNamePattern)

function exitWithError(...messages) {
  messages.forEach(message => console.log(message))
  process.exit(1)
}

function combineUris(...uris) {
  return uris.reduce(
    (combinedUri, uri) => (combinedUri.endsWith('/') ? `${combinedUri}${uri}` : `${combinedUri}/${uri}`)
  )
}

let pattern = commands[0]
!pattern && exitWithError('File pattern is required to run the parser.')
if (!pattern.endsWith('/')) pattern += '/'
glob(pattern)
  .then(matches =>
    Promise.all(
      // get file path glob matches, and run fs.stat on those paths to check if they're directories or direct links to package.json
      matches.map(filePath => resolve(filePath)).map(filePath =>
        stat(filePath).then(stats => {
          try {
            // get the package.json information and add the metadata to the Dependencies object
            const packageJson = stats.isDirectory() ? require(`${filePath}/package.json`) : require(filePath)
            const { name, dependencies, devDependencies, publishConfig, version } = packageJson
            const registry = publishConfig && publishConfig.registry
            deps.setDependencyRegistry(registry || registryUrl, name)
            deps.setDependencyVersion(version, name)
            _.forEach(dependencies, (range, depName) => deps.addDependencyVersion(range, depName))
            _.forEach(devDependencies, (range, depName) => deps.addDependencyVersion(range, depName))
          } catch (error) {
            exitWithError(`Could not load module from file path: ${filePath}`, error)
          }
        })
      )
    )
  )
  .then(
    () =>
      console.log('Dependencies') ||
      console.log('-----------------------') ||
      console.log(deps) ||
      Promise.all(
        _.map(
          // filter out any package metadata that doesn't have dependents
          _.pickBy(deps, ({ registry, versionRanges }) => registry && versionRanges && versionRanges.length),
          ({ registry, versionRanges }, depName) =>
            // check the registry to get source-of-truth metadata for the package
            request({
              method: 'GET',
              uri: combineUris(registry, depName),
              auth: {
                user,
                pass
              }
            }).then(response => {
              const { versions: registryVersions } = JSON.parse(response)
              const registryVersionNumbers = Object.keys(registryVersions)
              return {
                name: depName,
                // find the unique maximum version numbers downloadable based on all ranges set by dependents
                uniqueRegistryVersions: _.uniq(
                  versionRanges
                    .map(range => semver.maxSatisfying(registryVersionNumbers, range))
                    .filter(version => version != null)
                )
              }
            })
        )
      )
  )
  .then(
    depsMetadata =>
      console.log('Dependency Metadata') || console.log('-----------------------') || console.log(depsMetadata)
  )
  .catch(exitWithError)
