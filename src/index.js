const core = require('@actions/core');
const { Octokit } = require('@octokit/core');

// most @actions toolkit packages have async methods
async function run() {
    try {
        const godotVersion = core.getInput('godot_version');

        const octokit = new Octokit();
        const release = await octokit.request(
            'GET /repos/{owner}/{repo}/releases/tags/{tag}',
            {
                owner: 'godotengine',
                repo: 'godot',
                tag: godotVersion,
            }
        );

        core.info(JSON.stringify(release.data.assets));
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
