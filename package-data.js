const minimatch = require('minimatch')
const path = require('path')

class Package {
    constructor() {
        this.registry = ''
        this.path = ''
        this.dependents = {}
        this.localPackageInfo = {}
        this.remotePackageInfo = {}
    }

    get version() {
        return this.localPackageInfo.version
    }

    get remoteVersions() {
        return this.remotePackageInfo && this.remotePackageInfo.versions ? Object.keys(this.remotePackageInfo.versions) : []
    }
}

class PackagesData {
    constructor(filterPattern) {
        this.filterPattern = filterPattern
        /**
         * @type {Object.<string, Package>}
         */
        this._packageData = Object.create(null)
    }

    get packages() {
        return { ...this._packageData }
    }

    _initPackage(packageName) {
        if (!this._packageData[packageName]) {
            this._packageData[packageName] = new Package()
        }
        return this._packageData[packageName]
    }

    addDependent(packageName, dependentName, versionRange) {
        if (!this.filterPattern || minimatch(packageName, this.filterPattern)) {
            const pkg = this._initPackage(packageName)
            pkg.dependents[dependentName] = versionRange
        }
    }

    setLocalPath(packageName, localPath) {
        this._initPackage(packageName).path = path.resolve(localPath)
    }

    setRegistry(packageName, registry) {
        this._initPackage(packageName).registry = registry
    }

    setVersion(packageName, version) {
        this._initPackage(packageName).currentVersion = version
    }

    setLocalPackageInfo(packageName, packageJsonObject) {
        this._initPackage(packageName).localPackageInfo = packageJsonObject
    }

    setRemotePackageInfo(packageName, remotePackageJsonObject) {
        this._initPackage(packageName).remotePackageInfo = remotePackageJsonObject
    }
}
PackagesData.Package = Package

module.exports = PackagesData