# Remove Label from Cards

Removes one or more labels from all card issues in one or more columns of a project.

### columns_labels:  
A JSON Array of objects containing keys
 - `"labels"` An array of all the labels as strings  
 Either  
 - `"column_id"` The id of a column as an integer  
 or
 - `"column_name"` The name of the column
 - `"project_name"` The name of the project containing the column

## Example Usage
```
on:
  schedule:
    - cron:  '0 * * * *' # Run every hour

jobs:
  add_help_wanted_labels:
    runs-on: ubuntu-latest
    name: Remove labels based on column
    steps:
      - name: Remove labels based on column
        uses: rubyforgood/remove-label-from-cards@2.0
        id: remove-help-wanted-labels
        with:
          token: ${{secrets.GITHUB_TOKEN}}
          columns_labels: >
            [
              {
                "column_name": "Done (in prod!)",
                "labels": ["Help Wanted"],
                "project_name": "Test"
              },
              {
                "column_name": "To Do",
                "labels": ["Help Wanted"],
                "project_name": "Test"
              },
              {
                "column_id": 16739169,
                "labels": ["Help Wanted"]
              },
            ]
```
