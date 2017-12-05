#!/usr/bin/env node
const Promise = require('bluebird')
const _ = require('lodash')
const minimatch = require('minimatch')
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

const deps = Object.create(null)

function pushDependencyVersion (depVersion, depName) {
  if (dependencyNamePattern && !minimatch(depName, dependencyNamePattern)) return

  deps[depName] = deps[depName] || {}
  deps[depName].versions = deps[depName].versions || []
  if (!deps[depName].versions.some(version => version === depVersion)) {
    deps[depName].versions.push(depVersion)
  }
}

function setDependencyRegistry (registry, depName) {
  deps[depName] = deps[depName] || {}
  deps[depName].registry = registry
}

function setDependencyVersion (version, depName) {
  deps[depName] = deps[depName] || {}
  deps[depName].currentVersion = version
}

function exitWithError (...messages) {
  messages.forEach(message => console.log(message))
  process.exit(1)
}

function combineUris (...uris) {
  return uris.reduce(
    (combinedUri, uri) => (combinedUri.endsWith('/') ? `${ combinedUri }${ uri }` : `${ combinedUri }/${ uri }`)
  )
}

let pattern = commands[0]
if (!pattern.endsWith('/')) pattern += '/'
glob(pattern)
  .then(matches =>
    Promise.all(
      matches.map(filePath => resolve(filePath)).map(filePath =>
        stat(filePath).then(stats => {
          try {
            const packageJson = stats.isDirectory() ? require(`${ filePath }/package.json`) : require(filePath)
            const { name, dependencies, devDependencies, publishConfig, version } = packageJson
            const registry = publishConfig && publishConfig.registry
            setDependencyRegistry(registry || registryUrl, name)
            setDependencyVersion(version, name)
            _.forEach(dependencies, pushDependencyVersion)
            _.forEach(devDependencies, pushDependencyVersion)
          } catch (e) {
            exitWithError(`Could not load module from file path: ${ filePath }`, e)
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
          _.pickBy(deps, ({ registry, versions }) => registry && versions && versions.length),
          ({ registry, versions }, depName) =>
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
                uniqueRegistryVersions: _.uniq(
                  versions
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
