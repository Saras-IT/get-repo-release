# get-repo-release
Get latest release of Github Repo including draft and prerelease. Return information about release.

<em>Difference to other actions which returns latest release is that, this action get access to hiden draft releases.</em>

## Inputs

### `token`

**Required** Token to github repository to get access to hidden releases (draft releases)

### `excludes`

Exclude some types of releases separated by `,`. Examples: `draft,prerelease`, `prerelease,release`, `draft`

### `ignoreDate`

**Optional** If `true`, compares tags by tag value (ignoring creation date) to find the maximum tag. If `false`, returns the newest release by creation date. Default is `true`.

When `ignoreDate` is `true` (default), the action will:
- Compare tags semantically (e.g., `v26.4.2-1.40` > `v26.4.2-1.39`, `v2-prod-10.100` > `v2-prod-01.100`)
- Handle zero-padding correctly (e.g., `v2-prod-01.100` = `v2-prod-1.100`)
- Return the maximum tag value regardless of when it was created

When `ignoreDate` is `false`, the action will:
- Return the release with the newest creation date among filtered releases

### `view_top`

Numbers of releases which will be searched. Default value `100`.

## Outputs

### `id`

Founded release Id

### `name`

Founded release name

### `tag_name`

Founded release tag

### `created_at`

Founded release creation date

### `draft`

Founded release draft type flag (boolean: `true`, `false`).

### `prerelease`

Founded release prerelease type flag (boolean: `true`, `false`).

## Example usage
```yaml
steps:
  - uses: actions/checkout@v4
  - name: "call action"
    id: last_release
    uses: Saras-IT/get-repo-release@v1
    with:
      # The Github user or org that owns the repo. Default will be current owner.
      owner: ''
      # The repo name. Default will be current repo
      repo: ''
      # The repo name with org. E.g. myOrg/myRepo. Default will be current org/repo.
      repository: ''
      # GitHub Token
      token: ${{ github.token }}
      # Filter release tag.Use regex pattern like v16*
      filter: 'v2-*'
      # Types of releases to exclude (e.g. draft,prerelease,release).Comma seperated list.
      excludes: "release"
      # Compare tags by value (true) or by creation date (false). Default is true.
      ignoreDate: true
  - name: "Print result"
    run: |
      echo "id: ${{ steps.last_release.outputs.id }}"
      echo "name: ${{ steps.last_release.outputs.name }}"
      echo "tag_name: ${{ steps.last_release.outputs.tag_name }}"
      echo "created_at: ${{ steps.last_release.outputs.created_atd }}"
      echo "draft: ${{ steps.last_release.outputs.draft }}"
      echo "prerelease: ${{ steps.last_release.outputs.prerelease }}"
      echo "release: ${{ steps.last_release.outputs.release }}"
```
