import * as core from '@actions/core'
import * as github from '@actions/github'

interface Release {
    id: string;
    tag_name: string;
    prerelease: boolean;
    draft: boolean;
    created_at: string;
    name: string;
    upload_url: string;
}

/**
 * Compare two tag names to determine which is greater
 * Handles version-like tags by comparing numeric parts properly.
 * Zero-padded numbers are handled correctly (e.g., '01' and '1' are treated as equal,
 * '10' > '01', and '01.10' > '1.1')
 * Handles 'v' prefix in numeric parts (e.g., 'v26' vs 'v100' → 26 vs 100)
 * Supports multiple tag formats:
 *   - v2-prod-01.100, v2-prod-10.102 (with 'prod' in the middle)
 *   - v2-01.100, v2-10.102 (without 'prod')
 *   - v26.4.2-1.40, v26-1.37 (major.minor.patch-build format)
 *   - 25.0.6-5 (without 'v' prefix)
 * Returns: positive if tagA > tagB, negative if tagA < tagB, 0 if equal
 * Examples:
 *   - v2-prod-10.100 > v2-prod-01.100 (10 > 1)
 *   - v2-10.102 > v2-01.102 (10 > 1)
 *   - v26-1.37 > v26-1.36 (37 > 36)
 *   - v26.4.2-1.40 > v26.4.2-1.39 (40 > 39)
 *   - v100-1.37 > v26-1.37 (100 > 26, handles 'v' prefix correctly)
 *   - v2-prod-01.101 > v2-prod-01.100 (101 > 100)
 */
function compareTags(tagA: string, tagB: string): number {
    // Split tags into parts (handles formats like v2-prod-01.100 or v2-01.100)
    // Splits on both '.' and '-' to separate version components
    const partsA = tagA.split(/[.-]/);
    const partsB = tagB.split(/[.-]/);
    
    const maxLength = Math.max(partsA.length, partsB.length);
    
    for (let i = 0; i < maxLength; i++) {
        let partA = partsA[i] || '';
        let partB = partsB[i] || '';
        
        // Handle 'v' prefix: if part starts with 'v' and rest is numeric, extract number
        // This handles cases like 'v26' vs 'v100' correctly (26 < 100)
        if (partA.startsWith('v') && partA.length > 1) {
            const numPartA = partA.substring(1);
            if (!isNaN(parseInt(numPartA, 10))) {
                partA = numPartA;
            }
        }
        if (partB.startsWith('v') && partB.length > 1) {
            const numPartB = partB.substring(1);
            if (!isNaN(parseInt(numPartB, 10))) {
                partB = numPartB;
            }
        }
        
        // Try to compare as numbers if both are numeric
        // parseInt automatically handles zero-padding: '01' → 1, '10' → 10
        const numA = parseInt(partA, 10);
        const numB = parseInt(partB, 10);
        
        if (!isNaN(numA) && !isNaN(numB)) {
            // Both are numbers, compare numerically (handles zero-padding correctly)
            if (numA !== numB) {
                return numA - numB;
            }
        } else {
            // At least one is not a number, compare as strings
            if (partA !== partB) {
                return partA.localeCompare(partB);
            }
        }
    }
    
    // If all parts are equal, compare the full strings as fallback
    return tagA.localeCompare(tagB);
}

async function getLastReleaseByTagPattern(octokit: any, owner: string, repo: string, excludeReleaseTypes?: string, tagPattern?: string, ignoreDate: boolean = true): Promise<Release | null> {
    let page = 0;
    let releasesFinal: Release[] = [];
    const regex = tagPattern ? new RegExp(tagPattern) : null;
    const excludeTypes = excludeReleaseTypes ? excludeReleaseTypes.split(',') : [];

    while (true) {
        const response = await octokit.rest.repos.listReleases({
            owner,
            repo,
            per_page: 100, // Adjust the number of items per page as needed
            page,
        });

        let releases = response.data as Release[];

        // Filter releases based on the exclusion criteria and tag matching the specified regex pattern
        const filteredReleases = releases.filter(release => {
            if (core.isDebug()) {
                core.debug(`release -- Inner Loop: ${JSON.stringify(release, null, 2)}`);
            }
            if (excludeTypes.includes('prerelease') && release.prerelease) return false;
            if (excludeTypes.includes('draft') && release.draft) return false;
            if (excludeTypes.includes('release') && !release.prerelease && !release.draft) return false;
            if (regex && !regex.test(release.tag_name)) return false;
            return true;

        });

        // Add the filtered releases to the overall list of matching releases
        releasesFinal = releasesFinal.concat(filteredReleases);

        if (releases.length === 0) {
            break;
        }

        page++;
    }
    
    // Sort releases based on ignoreDate parameter
    if (ignoreDate) {
        // Sort by tag_name value (ignoring date) in descending order and return the maximum tag
        releasesFinal.sort((a, b) => compareTags(b.tag_name, a.tag_name));
        if (core.isDebug()) {
            core.debug(`Sorted by tag value (ignoring date). Final releases: ${JSON.stringify(releasesFinal, null, 2)}`);
        }
    } else {
        // Sort by created_at in descending order and return the newest by date
        releasesFinal.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (core.isDebug()) {
            core.debug(`Sorted by creation date (newest first). Final releases: ${JSON.stringify(releasesFinal, null, 2)}`);
        }
    }
    
    if (releasesFinal.length > 0) {
        return releasesFinal[0];
    } else {
        throw new Error('No matching releases found');
    }
}
async function run(): Promise<void> {
    // Get input values
    let repo_owner = core.getInput('owner');
    let repo_name = core.getInput('repo');
    const repository = core.getInput('repository');
    const myToken = core.getInput('token');
    const excludeRelease = core.getInput('excludes')
    const excludeReleaseTypes = core.getInput('excludes').split(',');
    const filterTag = core.getInput('filter');
    const ignoreDateInput = core.getInput('ignoreDate');
    // Convert ignoreDate input to boolean, defaulting to true if not provided or if value is 'true'
    const ignoreDate = ignoreDateInput === '' || ignoreDateInput.toLowerCase() === 'true';
    if (repository) {
        [repo_owner, repo_name] = repository.split("/");
    }
    if (!repo_name && !repo_name) {
        repo_name = github.context.repo.repo;
        repo_owner = github.context.repo.owner;
    }
    try {
        const octokit = github.getOctokit(myToken);
        getLastReleaseByTagPattern(octokit, repo_owner, repo_name, excludeRelease, filterTag, ignoreDate) // Pass 'prerelease', 'draft', or both to exclude those types
            .then(release => {
                if (release) {
                    if (core.isDebug()) {
                        console.log(`Most recent release matching the criteria:`);
                        console.log(`${release.name} with tag: ${release.tag_name}, created at: ${release.created_at}`);
                        WriteDebug(release);
                    }
                    setOutput(release);
                }
            })
            .catch(error => {
                console.error(error.message);
                core.setFailed(error.message);
            });
    } catch (err: unknown) {
        if (err instanceof Error) core.error(err.message);
        core.error(String(err));
    }
}


/**
 * Setup action output values
 * @param release - founded release
 */
function setOutput(release: Release): void {
    core.setOutput('id', release.id);
    core.setOutput('name', release.id);
    core.setOutput('tag_name', release.tag_name);
    core.setOutput('version', String(release.tag_name).replace('v', ''));
    core.setOutput('created_at', release.created_at);
    core.setOutput('draft', release.draft);
    core.setOutput('prerelease', release.prerelease);
    core.setOutput('release', !release.prerelease && !release.draft);
    core.setOutput('upload_url', release.upload_url);
}

/**
 * Write debug
 * @param release - founded release
 */
function WriteDebug(release: Release): void {
    core.debug(`id: ${release.id}`);
    core.debug(`name: ${release.name}`)
    core.debug(`tag_name: ${release.tag_name}`);
    core.debug(`created_at: ${release.created_at}`);
    core.debug(`draft: ${release.draft}`);
    core.debug(`prerelease: ${release.prerelease}`);
}

run();
