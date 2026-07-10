import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const tauriConfPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
const cargoTomlPath = path.join(__dirname, '../src-tauri/Cargo.toml');
const changelogPath = path.join(__dirname, '../CHANGELOG.md');

try {
  // Read the new version from package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;

  // Update tauri.conf.json
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = version;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`✅ Updated tauri.conf.json to version ${version}`);

  // Update Cargo.toml
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoToml = cargoToml.replace(/^version\s*=\s*".*?"/m, `version = "${version}"`);
  fs.writeFileSync(cargoTomlPath, cargoToml);
  console.log(`✅ Updated Cargo.toml to version ${version}`);

  // Generate Changelog
  let lastTag = '';
  try {
    lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch (e) {
    // No tags yet
  }

  const date = new Date().toISOString().split('T')[0];
  let newChangelogEntry = `## [${version}] - ${date}\n\n`;

  try {
    const gitLogCmd = lastTag 
      ? `git log ${lastTag}..HEAD --pretty=format:"- %s"`
      : `git log --pretty=format:"- %s"`;
    const commits = execSync(gitLogCmd, { encoding: 'utf8' }).trim();
    if (commits) {
      newChangelogEntry += commits + '\n\n';
    } else {
      newChangelogEntry += '- No new commits.\n\n';
    }
  } catch (e) {
    newChangelogEntry += '- Could not generate changelog from git commits.\n\n';
  }

  let existingChangelog = '';
  if (fs.existsSync(changelogPath)) {
    existingChangelog = fs.readFileSync(changelogPath, 'utf8');
  } else {
    existingChangelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }

  // Prepend new entry after the main title
  if (existingChangelog.startsWith('# Changelog')) {
    existingChangelog = existingChangelog.replace(
      /# Changelog\n*/,
      `# Changelog\n\n${newChangelogEntry}`
    );
  } else {
    existingChangelog = newChangelogEntry + existingChangelog;
  }

  fs.writeFileSync(changelogPath, existingChangelog);
  console.log(`✅ Updated CHANGELOG.md for version ${version}`);

  console.log(`\n🎉 Successfully synced version ${version} to all Tauri configuration files.`);
} catch (error) {
  console.error('❌ Failed to sync versions:', error);
  process.exit(1);
}
