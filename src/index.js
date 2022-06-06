const core = require('@actions/core');
const { Octokit } = require('@octokit/core');
const fs = require('fs');
const path = require('path');
const request = require('request');
const Seven = require('node-7z');
const { exec } = require('@actions/exec');

const godotWorkingDir = './.godot';

// most @actions toolkit packages have async methods
async function run() {
    try {
        const godotVersion = core.getInput('godot_version');
        const useMono = core.getInput('use_mono');
        const baseDir = core.getInput('base_dir');
        const exportTemplates = JSON.parse(core.getInput('export_templates'));

        core.info(`Godot version: ${godotVersion}`);
        core.info(`Use Mono: ${useMono}`);

        core.info('');
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

        await extractFile(headlessGodotAsset.name, godotWorkingDir);

        core.info('Finished extracting the files!');

        let godotExecutable = `${godotWorkingDir}/${headlessGodotAsset.name.replace('.zip', '')}/${headlessGodotAsset.name.replace('_64.zip', '.64')}`;
        godotExecutable = path.resolve(godotExecutable);

        exportTemplates.forEach((exportTemplate) => {
            exec(godotExecutable, ['--path', baseDir, '--export', `${exportTemplate}`, 'some_name.exe', '--verbose']);
        });
    } catch (error) {
        core.setFailed(error.message);
    }
}

async function extractFile(fileName, destination) {
    return new Promise((resolve) => {
        const myStream = Seven.extractFull(fileName, destination, {
            $progress: false,
            noRootDuplication: true,
        });
        myStream.on('end', function () {
            resolve();
        });
    });
}

async function downloadFile(uri, filename) {
    return new Promise((resolve) => {
        request.get(uri).pipe(fs.createWriteStream(filename)).on('finish', resolve);
    });
    // await get(uri, {});
}

run().catch((err) => {
    core.setFailed(err.message);
    process.exit(1);
});
