function combineUris(...uris) {
    return uris.reduce(
        (combinedUri, uri) => (combinedUri.endsWith('/') ? `${combinedUri}${uri}` : `${combinedUri}/${uri}`)
    )
}

function exitWithError(...messages) {
    messages.forEach(message => console.log(message))
    process.exit(1)
}

module.exports = {
    combineUris,
    exitWithError
}