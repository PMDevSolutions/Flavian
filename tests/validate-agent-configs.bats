#!/usr/bin/env bats

VALIDATOR="./scripts/validate-agent-configs.sh"

# --- Agent frontmatter validation ---

@test "valid agent config passes validation" {
  run bash "$VALIDATOR" --agents-dir tests/fixtures --file valid-agent.md
  [ "$status" -eq 0 ]
}

@test "agent missing name field fails validation" {
  run bash "$VALIDATOR" --agents-dir tests/fixtures --file invalid-agent-no-name.md
  [ "$status" -ne 0 ]
  [[ "$output" == *"missing required field: name"* ]]
}

@test "agent missing description field fails validation" {
  run bash "$VALIDATOR" --agents-dir tests/fixtures --file invalid-agent-no-description.md
  [ "$status" -ne 0 ]
  [[ "$output" == *"missing required field: description"* ]]
}

@test "agent with invalid model value fails validation" {
  run bash "$VALIDATOR" --agents-dir tests/fixtures --file invalid-agent-bad-model.md
  [ "$status" -ne 0 ]
  [[ "$output" == *"invalid model"* ]]
}

@test "agent with hook referencing non-existent script fails validation" {
  run bash "$VALIDATOR" --agents-dir tests/fixtures --file invalid-agent-bad-hook-script.md
  [ "$status" -ne 0 ]
  [[ "$output" == *"hook script not found"* ]]
}

# --- Skill frontmatter validation ---

@test "valid skill config passes validation" {
  run bash "$VALIDATOR" --skills-dir tests/fixtures --file valid-skill.md
  [ "$status" -eq 0 ]
}

@test "skill missing name field fails validation" {
  run bash "$VALIDATOR" --skills-dir tests/fixtures --file invalid-skill-no-name.md
  [ "$status" -ne 0 ]
  [[ "$output" == *"missing required field: name"* ]]
}

# --- Settings JSON validation ---

@test "valid settings.json passes validation" {
  run bash "$VALIDATOR" --settings tests/fixtures/valid-settings.json
  [ "$status" -eq 0 ]
}

@test "invalid JSON in settings fails validation" {
  run bash "$VALIDATOR" --settings tests/fixtures/invalid-settings-bad-json.json
  [ "$status" -ne 0 ]
  [[ "$output" == *"invalid JSON"* ]]
}

@test "settings with missing matcher fails validation" {
  run bash "$VALIDATOR" --settings tests/fixtures/invalid-settings-bad-hook-structure.json
  [ "$status" -ne 0 ]
  [[ "$output" == *"missing required field: matcher"* ]]
}

# --- Full project validation ---

@test "full project validation runs without error on real configs" {
  run bash "$VALIDATOR"
  [ "$status" -eq 0 ]
}
