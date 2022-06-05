const core = require('@actions/core');
const { Octokit } = require('@octokit/core');
const fs = require('fs');
const request = require('req');

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
    } catch (error) {
        core.setFailed(error.message);
    }
}

function downloadFile(uri, filename) {
    new Promise((resolve, reject) => {
        request.head(uri, (err, res, body) => {
            console.log('\n', 'Downloading File');
            request(uri)
                .on('error', (error) => {
                    res.status(502).send(error.message);
                    reject(error);
                })
                .pipe(fs.createWriteStream(filename))
                .on('finish', resolve);
        });
    });
}

// function getFile(url) {
//     return new Promise((resolve, reject) => {
//         http.get(url, (response) => {
//             const { statusCode } = response;
//             if (statusCode === 200) {
//                 resolve(response);
//             }
//             reject(null);
//         });
//     });
// }

// async function downloadFile(url, fileName) {
//     const response = await getFile(url);
//     if (response) {
//         const file = fs.createWriteStream(fileName);
//         response.pipe(file);
//     }
// }

run().catch((err) => {
    core.setFailed(err.message);
    process.exit(1);
});
