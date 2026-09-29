# Roadmap

- [x] STT/TTS/translation switched from Bhashini to built-in AI (Lovable AI Gateway)
- [x] Dashboard input choice: manual form / text file / voice (built-in STT) / camera
- [x] Missing-details check: Fill / Accept / Reject / Withdraw before analysis
- [x] Report Accept / Reject actions
- [x] Whole-app translation (Indian languages via built-in AI) + optional TTS read-out
- [x] Understanding and standards matching stays on built-in AI

## OpenAI + Assistant
- [ ] Switch analysis/vision/translation/STT/TTS to user's OpenAI key (OPENAI_API_KEY)
- [ ] Multi-thread AI assistant chat (saved to account) on Dashboard + Standards search, with mic (STT) + listen (TTS)
- [ ] Assistant explains standards: importance, use/relevance, why not others, further uses; guides app usage
- [ ] Word (.docx) extraction via mammoth
- [ ] E2E test

## Normative Reference Graph
- [x] Replace OpenAI key (user)
- [x] standard_relations table (normative/informative/test_method/safety/terminology/installation/component/related_product/supersedes/replaced_by)
- [x] Server traversal of relations from recommended primary standards
- [x] Expandable tree/card view on recommendations + standard detail
