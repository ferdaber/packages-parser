const semver = require('semver')
const _ = require('lodash')

const PackagesData = require('./package-data')
const Package = PackagesData.Package

function getMaxVersion(versions) {
  return versions.reduce((max, version) => semver.gt(version, max) ? version : max)
}

/**
 * @param {Package} pkg
 */
function getResolvedDependentsVersions(pkg) {
  return _.mapValues(pkg.dependents, (range, depName) => ({
    range,
    resolvedVersion: semver.maxSatisfying(pkg.remoteVersions, range)
  }))
}

function getOutdatedDependents(pkg) {
  const resolvedDependentVersions = getResolvedDependentsVersions(pkg)
  
}

module.exports = {
  getMaxVersion,
  getResolvedDependentsVersions,
  getOutdatedDependents
}