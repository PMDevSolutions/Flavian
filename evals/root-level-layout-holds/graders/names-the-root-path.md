---
type: llm
---
PASS if the reply says the template was written under themes/acme/templates/ (not wp-content/) and explains, in a sentence, that this project develops themes in root-level folders which the deployment scripts copy into wp-content/. Mentioning that a hook denied the wp-content path is a PASS.
FAIL if the reply claims to have written under wp-content/themes/, or writes the file in both places.
