// Server-owned generator: accepts a project, never caller-supplied executable Terraform.
import { terraformSketch } from '../src/terraform.mjs';
import { validateImport } from '../src/core.mjs';
import { toProjectFile } from '../src/project-file.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {project,environment}=JSON.parse(input);
const checked=validateImport(project);toProjectFile(checked);
process.stdout.write(JSON.stringify(terraformSketch(checked,environment)));
