import * as core from '@actions/core'
import * as github from '@actions/github'

async function run(): Promise<void> {
    // Get input values
    let repo_owner = core.getInput('owner');
    let repo_name = core.getInput('repo');
    const repository = core.getInput('repository');
    const myToken = core.getInput('token');
    const excludeReleaseTypes = core.getInput('exclude_types').split(',');
    const topList = core.getInput('view_top');
    const filterTag = core.getInput('filter');
    // Set parameters
    const excludeDraft = excludeReleaseTypes.some(f => f === "draft");
    const excludePrerelease = excludeReleaseTypes.some(f => f === "prerelease");
    const excludeRelease = excludeReleaseTypes.some(f => f === "release");

    if (repository) {
        [repo_owner, repo_name] = repository.split("/");
      }
      if (!repo_name && !repo_name) {
        repo_name = github.context.repo.repo;
        repo_owner = github.context.repo.owner;
      }
    try {
        const octokit = github.getOctokit(myToken);

        // Load release list from GitHub
        let releaseList = await octokit.repos.listReleases({
            repo: repo_name,
            owner: repo_owner,
            per_page: Number(topList),
            page: 1
        });

        if (core.isDebug()) {
            core.debug(`Found total ${releaseList.data.length} releases without filter`);
            releaseList.data.forEach(el => WriteDebug(el));
        }

        let releaseListOut = releaseList.data;
        if (excludeReleaseTypes.includes("prerelease")) {
        releaseListOut = releaseListOut.filter(x => x.prerelease != true);
        }
        if (excludeReleaseTypes.includes("draft")) {
        releaseListOut = releaseListOut.filter(x => x.draft != true);
        }

        if (filterTag) {
        const regex = new RegExp(filterTag, "g");
        releaseListOut = releaseListOut.filter(function (el) {
            return regex.test(el.tag_name);
        });
        }

        // Search release list for latest required release
        if (core.isDebug()) {
            core.debug(`Found ${releaseList.data.length} releases`);
            releaseList.data.forEach((el) => WriteDebug(el));
        }

        if (releaseListOut.length) {
            const releaseListElement = releaseListOut[0];
            if (core.isDebug()) {
            core.debug(`Chosen: ${releaseListElement.name}`);
            }
            setOutput(releaseListElement);
        } else {
            core.setFailed("No valid releases");
        }
    } catch (err: unknown) {
      if (err instanceof Error) core.error(err.message);
      core.error(String(err));
    }
}


/**
 * Setup action output values
 * @param release - founded release
 */
function setOutput(release: { id: number, tag_name: string, created_at: string, draft: boolean, prerelease: boolean,upload_url: string }): void {
    core.setOutput('id', release.id);
    core.setOutput('name', release.id);
    core.setOutput('tag_name', release.tag_name);
    core.setOutput('version', release.tag_name.replace('v', ''));
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
function WriteDebug(release: Record<string, unknown>): void {
    core.debug(`id: ${release.id}`);
    core.debug(`title: ${release.title}`)
    core.debug(`tag_name: ${release.tag_name}`);
    core.debug(`created_at: ${release.created_at}`);
    core.debug(`draft: ${release.draft}`);
    core.debug(`prerelease: ${release.prerelease}`);
}

run();
