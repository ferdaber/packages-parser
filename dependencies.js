const minimatch = require('minimatch')

module.exports = class Dependencies {
    _map = Object.create(null)
    
    constructor(filterPattern) {
        this.filterPattern = filterPattern
    }

    _initDep (depName) {
        this._map[depName] = this._map[depName] || {}
        return this._map[depName]
    }

    addDependencyVersion(versionRange, depName) {
        if (!this.filterPattern || minimatch(depName, this.filterPattern)) {
            const depData = this._initDep(depName)
            depData.versionRanges = depData.versionRanges || []

            if (!depData.versionRanges.some(range => range === versionRange)) {
                depData.versionRanges.push(versionRange)
            }
        }
    }

    setDependencyRegistry(registry, depName) {
        this._initDep(depName).registry = registry
    }

    setDependencyVersion(version, depName) {
        this._initDep(depName).currentVersion = version
    }
}