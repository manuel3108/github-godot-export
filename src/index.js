const core = require('@actions/core');
const { Octokit } = require('@octokit/core');
const fs = require('fs');
const path = require('path');
const request = require('request');
const Seven = require('node-7z');
const { exec } = require('@actions/exec');
const ini = require('ini');
const glob = require('glob');

const godotWorkingDir = './.godot';

async function run() {
    try {
        const godotVersion = core.getInput('godot_version');
        const useMono = core.getInput('use_mono');
        const baseDir = core.getInput('base_dir');

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
        core.info('Extracting godot export templates...');

        const templatesPathString = `/home/runner/.local/share/godot/templates/`;
        const templatesTempPathString = templatesPathString + 'temp/';
        fs.mkdirSync(templatesTempPathString, { recursive: true });
        await extractFile(exportTemplatesAsset.name, templatesTempPathString);
        fs.renameSync(`${templatesTempPathString}templates/`, `${templatesPathString}${godotVersion.replace('-', '.')}${useMono ? '.mono' : ''}/`);

        core.info('Finished extracting the files!');

        let godotExecutable = `${godotWorkingDir}/${headlessGodotAsset.name.replace('.zip', '')}/${headlessGodotAsset.name.replace('_64.zip', '.64')}`;
        godotExecutable = path.resolve(godotExecutable);

        var config = ini.parse(fs.readFileSync(path.join(baseDir, 'export_presets.cfg'), 'utf-8'));
        const exportTemplates = Object.entries(config.preset).map(([_, value]) => value);

        for (const exportTemplate of exportTemplates) {
            fs.mkdirSync(exportTemplate.export_path, { recursive: true });
            await exec(godotExecutable, ['--path', baseDir, '--export', `${exportTemplate.name}`, exportTemplate.export_path]);

            const exportDirectoryPath = path.dirname(path.join(baseDir, exportTemplate.export_path));
            const exportDirectoryName = path.basename(exportDirectoryPath);
            var files = glob.sync(`${exportDirectoryPath}/**/*.*`);
            core.info(files);
            if (files.length > 1 && exportTemplate.platform != 'Mac OSX') {
                core.info(`Found ${files.length} files in ${exportDirectoryPath}. Zipping files...`);

                await compressFile(`${exportDirectoryPath}`, `${exportDirectoryPath}/${exportDirectoryName}.zip`);

                core.info(`Finished zipping files!`);
                // core.info(`Deleting zipped files...`);

                // files.forEach((file) => {
                //     fs.unlinkSync(file);
                // });

                // core.info(`Finished deleting files!`);
            } else {
                core.info(`Found ${files.length} files in ${exportDirectoryPath}. Skipping zipping...`);

                const fileExtensions = path.extname(files[0]);
                fs.renameSync(files[0], `${exportDirectoryPath}/${exportDirectoryName}${fileExtensions}`);

                core.info(`Finished renaming files!`);
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

async function compressFile(fileName, destination) {
    return new Promise((resolve) => {
        const myStream = Seven.add(fileName, destination, {
            $progress: false,
            noRootDuplication: true,
        });
        myStream.on('end', function () {
            resolve();
        });
    });
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
}

run().catch((err) => {
    core.setFailed(err.message);
    process.exit(1);
});
