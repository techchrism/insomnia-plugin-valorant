
function compareSemver(a: [number, number, number], b: [number, number, number]): number {
    for(let i = 0; i < 3; i++) {
        if(a[i] > b[i]) return 1
        if(a[i] < b[i]) return -1
    }
    return 0
}

/**
 * Checks if the workspace actions bug ( https://github.com/ArchGPT/insomnium/issues/109 ) is present
 * Uses a simple version check against the navigator.userAgent string
 * @returns {boolean} True if the bug is present, false otherwise
 */
export function hasWorkspaceActionsBug(): boolean {
    const match = navigator.userAgent.match(/Insomnium\/(\S+)/)
    if(match === null) return false
    const version = match[1].split('-')[0]
    const [major, minor, patch] = version.split('.').map(v => parseInt(v))

    //TODO update this when the bug is fixed. The bug was last observed in 0.2.3
    return compareSemver([major, minor, patch], [0, 2, 3]) <= 0
}