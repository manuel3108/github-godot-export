const core = require('@actions/core');
const { Octokit } = require('@octokit/core');
const fs = require('fs');
const request = require('request');
const Seven = require('node-7z');
const { exec } = require('child_process');

const godotWorkingDir = './.godot';

// most @actions toolkit packages have async methods
async function run() {
    try {
        const godotVersion = core.getInput('godot_version');
        const useMono = core.getInput('use_mono');

        core.info(`Godot version: ${godotVersion}`);
        core.info(`Use Mono: ${useMono}`);

        core.info();
        core.info('Getting the release for the selected version...');

        const octokit = new Octokit();
        const release = await octokit.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
            owner: 'godotengine',
            repo: 'godot',
            tag: godotVersion,
        });

        core.info(`Found release with id ${release.data.id} created at ${release.data.created_at}`);

        const assets = release.data.assets;
        const headlessGodotAsset = assets.find((asset) => asset.name === `Godot_v${godotVersion}${useMono ? '_mono' : ''}_linux_headless_64.zip`);
        const exportTemplatesAsset = assets.find((asset) => asset.name === `Godot_v${godotVersion}${useMono ? '_mono' : ''}_export_templates.tpz`);

        core.info(`Found headless Godot asset and downloading it from ${headlessGodotAsset.browser_download_url}`);
        core.info(`Found export templates asset and downloading it from ${exportTemplatesAsset.browser_download_url}`);

        const downloadGodot = downloadFile(headlessGodotAsset.browser_download_url, headlessGodotAsset.name);
        const downloadExportTemplates = downloadFile(exportTemplatesAsset.browser_download_url, exportTemplatesAsset.name);
        await Promise.all([downloadGodot, downloadExportTemplates]);

        core.info('Finished downloading the files!');
        core.info('Extracting godot headless...');

        Seven.extractFull(headlessGodotAsset.name, godotWorkingDir, {
            $progress: false,
        });

        core.info('Finished extracting the files!');

        exec(`${godotWorkingDir}/${headlessGodotAsset.name}`);
    } catch (error) {
        core.setFailed(error.message);
    }
}

function downloadFile(uri, filename) {
    new Promise((resolve) => {
        request.get(uri).pipe(fs.createWriteStream(filename)).on('finish', resolve);
    });
}

run().catch((err) => {
    core.setFailed(err.message);
    process.exit(1);
});
