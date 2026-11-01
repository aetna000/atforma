# Source and licensing audit — 2026-11-01

## Scope and status

Three public repositories were cloned read-only to a temporary audit directory and pinned in `upstream-lock.json`, including licence-file hashes. Top-level licences, root notices, the AWS MCP tree's per-server notice structure, root dependency declarations and selected implementation files were inspected. This is a preliminary engineering inventory, not a legal clearance or proof of all transitive rights.

## Findings

| Upstream | Verified licence | MVP treatment |
| --- | --- | --- |
| OpenArchFlow | MIT | Six catalogue descriptions adapted, original notice and full licence preserved. Canvas is independently implemented using React Flow. |
| AWS architect sample | MIT No Attribution | Workflow concepts adapted; no Python implementation or prompt copied. AWS-only prompt explicitly excludes competitors, which is incompatible with the product scope. |
| AWS Labs MCP | Apache-2.0 | Disabled integration metadata only. Root licence and NOTICE preserved. Individual server folders also contain notices and licences. |

The verified top-level licences permit commercial use subject to their terms; they do not by themselves impose a requirement to publish original product source. They do not clear dependencies, vendor assets, service access terms or all possible third-party rights. MIT requires its copyright and permission notice to accompany copies/substantial portions. Apache redistribution requires the licence, relevant retained notices, applicable NOTICE attribution, and prominent change notices in modified distributed files. Apache also contains an explicit patent grant with conditions and excludes trademark rights. MIT-0 has no notice-retention condition, but provenance is retained voluntarily.

## Dependencies and assets

The MVP intentionally uses a smaller dependency set than either upstream application. Exact versions and resolved integrity hashes are in `package-lock.json`. `dependency-inventory.json` lists installed direct/transitive application and development packages; no installed package has missing declared licence metadata in this scan. The scan does not establish that every file is covered or that SPDX metadata is conclusive. Platform-specific optional packages not installed on this Mac need review if distributed elsewhere. Two native build packages omit root licence files; their parent build-tool licences are in the notice bundle, and their platform package provenance remains a release-review item.

The OpenArchFlow dependencies (including its icon packs) and AWS sample's Python dependencies have not been incorporated wholesale or cleared. AWS MCP candidate dependencies are recorded but not installed. The generated notice bundle includes development packages for completeness; development packages are not automatically part of the browser bundle. Font files are self-hosted with their supplied font licences. Icons use Lucide; cloud identifiers use original text badges. No AWS/Azure/Google/IBM logos, demo screenshots, upstream videos, model weights or datasets are copied.

## Commercial-release work remaining

- Review the exact production artifact and all redistributed dependency/asset licences; regenerate notices and an SBOM for the target distribution.
- Review source changes and actual files reused when adding agent or MCP implementations; retain per-file and per-server obligations. Do not assume the root licence covers every asset.
- Verify provider OAuth, API, model and cloud service terms for the intended SaaS, desktop or self-hosted model. Open-source licences do not grant subscription inference rights or cloud service access.
- Review branding, product name availability and trademark use before public commercial launch. Forma is a working title only.
- Establish ownership/licensing of original code and any third-party contributions. No public open-source grant is applied to original product code in this MVP.
- Add tenant isolation, secure credentials, account authorisation, production billing and real deployment controls before customer use.

## Verification limits

No upstream software was production-tested during this audit. The MVP's structural and fixture tests are not a Well-Architected certification, compliance assessment, model evaluation, cloud integration test or deployment result. A private preview does not constitute commercial-release clearance.
