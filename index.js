#!/usr/bin/env node
const _ = require('lodash')
const PackageData = require('./package-data')
const minimatch = require('minimatch')
const Promise = require('bluebird')
const request = require('request-promise')
const { resolve } = require('path')
const semver = require('semver')
const prettyFormat = require('pretty-format')

const { combineUris, exitWithError } = require('./utils')
const { getResolvedDependentsVersions } = require('./package-utils')

const stat = Promise.promisify(require('fs').stat)
const glob = Promise.promisify(require('glob'))

const {
  _: commands,
  dependencyNamePattern,
  registryUrl = 'https://registry.npmjs.org',
  user,
  pass
} = require('yargs').argv

const packagesData = new PackageData(dependencyNamePattern)

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
            const { name, dependencies, devDependencies, publishConfig } = packageJson
            const registry = publishConfig && publishConfig.registry
            packagesData.setRegistry(name, registry || registryUrl)
            packagesData.setLocalPackageInfo(name, packageJson)
            packagesData.setLocalPath(name, filePath)
            _.forEach(dependencies, (range, packageName) => packagesData.addDependent(packageName, name, range))
            _.forEach(devDependencies, (range, packageName) => packagesData.addDependent(packageName, name, range))
          } catch (error) {
            exitWithError(`Could not load module from file path: ${filePath}`, error)
          }
        })
      )
    )
  )
  .then(() =>
    Promise.all(
      _.map(_.pickBy(packagesData.packages, pkg => pkg.registry != null), (pkg, packageName) =>
        request({
          method: 'GET',
          uri: combineUris(pkg.registry, packageName),
          auth: {
            user,
            pass
          }
        }).then(response => {
          const remotePackageData = JSON.parse(response)
          packagesData.setRemotePackageInfo(packageName, remotePackageData)
          return packagesData.packages[remotePackageData]
        }).catch(error => {
          if (error.statusCode === 404) {
            console.warn(`Package not found for '${packageName}', tried looking in: ${error.options.uri}, skipping this package.`)
          }
        })
      )
    )
  )
  .then(() => {
    // do stuff here, local and remote package data is fully hydrated at this point
    const resolvedDependentsVersions = _.mapValues(packagesData.packages, pkg => ({
      dependents: getResolvedDependentsVersions(pkg)
    }))
    console.log(prettyFormat(packagesData.packages))
    console.log('=====================================================')
    console.log(prettyFormat(resolvedDependentsVersions))
  })
  .catch(exitWithError)
