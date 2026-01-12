# LLM-Based Signal Extraction

## Overview

The airline interactive demo now supports **LLM-based signal extraction** using OpenAI's GPT-4o Mini model. This enables more robust signal extraction from natural language text.

**Problem it solves:**
- Regex-only extraction misses signals written in natural language
- Example: User says `"I want to refund $90"` but agent generates response without mentioning $90
- LLM extracts from BOTH user message and agent response, catching signals deterministic extraction misses

## How It Works

### Two-Tier Extraction

1. **Deterministic (Always)** - Regex-based extraction for:
   - Currency amounts: `$90`, `€100`, `£50`
   - Keywords: `refund`, `charge`, `fee`, `escalate`
   - Urgency words: `immediately`, `right away`, `automatic`

2. **LLM-Assisted (Optional)** - OpenAI GPT-4o Mini for:
   - Natural language understanding
   - Context-aware signal extraction
   - Confidence scoring
   - Fallback when deterministic fails

### Merge Strategy

```
User Message: "I want to refund $90"
  ↓ Deterministic: monetary_amount = 90
  ↓ LLM: policy_keyword = "refund", requires_escalation = false

Agent Response: "I understand you'd like a refund. Could you tell me..."
  ↓ Deterministic: has_monetary_value = false
  ↓ LLM: policy_keyword = "refund"

Final Merged Signals:
  - monetary_amount: 90 (from user, preserved)
  - policy_keyword: "refund" (confirmed by both)
  - has_monetary_value: true (from user)
```

## Setup

### 1. Get OpenAI API Key

```bash
# Visit https://platform.openai.com/api/keys
# Create a new API key
# Copy it to your environment
```

### 2. Create `.env` File

Copy the example and configure:

```bash
cd packages/examples
cp .env.example .env
```

Edit `.env`:

```
MANDATE_URL=http://localhost:3001
MANDATE_API_KEY=your-api-key
ENABLE_LLM_EXTRACTION=true
OPENAI_API_KEY=sk-proj-xxx...
OPENAI_MODEL=gpt-4o-mini
```

### 3. Run the Interactive Agent

```bash
cd packages/examples
ENABLE_LLM_EXTRACTION=true OPENAI_API_KEY=sk-... pnpm ts-node src/airline-demo/interactive-chatbot-agent.ts
```

Or use `.env` file:

```bash
cd packages/examples
pnpm ts-node src/airline-demo/interactive-chatbot-agent.ts
```

## Example Output

### With LLM Extraction Enabled

```
════════════════════════════════════════════════════════════════════════════════
MESSAGE #1
════════════════════════════════════════════════════════════════════════════════

[OBSERVE] Step 1: Extracting signals from user message...
[OBSERVE] Using LLM-based extraction (deterministic + OpenAI)

[LLM_EXTRACTOR] Calling gpt-4o-mini...
[LLM_EXTRACTOR] Response: {
  "has_monetary_value": { "value": true, "confidence": 0.95 },
  "monetary_amount": { "value": 90, "confidence": 0.98 },
  "policy_keyword": { "value": "refund", "confidence": 0.99 },
  "requires_escalation": { "value": false, "confidence": 0.92 }
}

[OBSERVE] User signals: {
  "has_monetary_value": true,
  "monetary_amount": 90,
  "policy_keyword": "refund",
  "requires_escalation": false
}

[OBSERVE] Step 2: Generating draft response...
[AGENT] Draft: "I understand you'd like a refund. Could you tell me the amount..."

[OBSERVE] Step 3: Extracting signals from agent response...
[LLM_EXTRACTOR] Calling gpt-4o-mini...

[OBSERVE] Agent signals: {
  "has_monetary_value": false,
  "policy_keyword": "refund",
  "requires_escalation": false
}

[OBSERVE] Step 4: Merging signals...
[OBSERVE] Merged signals: {
  "has_monetary_value": true,          ← From user (preserved)
  "monetary_amount": 90,               ← From user (preserved)
  "policy_keyword": "refund",          ← From both (confirmed)
  "requires_escalation": false         ← From agent
}

[MANDATE] Step 5: Submitting to Mandate...

[VERDICT] Step 6: Result:
  Verdict: ALLOW
  Policies: pol-refund-002
  Escalation: (none)

[ACTION] Sending original response
```

### Without LLM (Deterministic Only)

```
[OBSERVE] Using deterministic extraction only (set ENABLE_LLM_EXTRACTION=true for LLM)

[OBSERVE] User signals: {
  "has_monetary_value": true,
  "monetary_amount": 90,
  "policy_keyword": "refund",
  "requires_escalation": false
}

[OBSERVE] Agent signals: {
  "has_monetary_value": false,
  "policy_keyword": "refund",
  "requires_escalation": false
}

[OBSERVE] Merged signals: {
  "has_monetary_value": true,
  "monetary_amount": 90,
  "policy_keyword": "refund",
  "requires_escalation": false
}
```

## Test the Extractor Standalone

Test LLM extraction without running the full agent:

```bash
cd packages/examples
OPENAI_API_KEY=sk-... pnpm ts-node src/airline-demo/llm-signal-extractor.ts
```

Output:

```
[TEST] Testing LLM Signal Extractor
[TEST] Text: "I want to cancel the booking for BK3681 and I want you to refund the amount $90 USD please"
[TEST] Model: gpt-4o-mini
[TEST] Signals to extract: has_monetary_value, monetary_amount, policy_keyword, booking_id

[LLM_EXTRACTOR] Calling gpt-4o-mini...
[LLM_EXTRACTOR] Extracted signals: {
  "has_monetary_value": { "value": true, "confidence": 0.98 },
  "monetary_amount": { "value": 90, "confidence": 0.99 },
  "policy_keyword": { "value": "refund", "confidence": 0.99 },
  "booking_id": { "value": "BK3681", "confidence": 0.95 }
}
```

## Signals Supported

| Signal | Type | Example | LLM Assists |
|--------|------|---------|-------------|
| `has_monetary_value` | boolean | `$90 mentioned` | ✓ When $ not present |
| `monetary_amount` | number | `90` from `$90` | ✓ Natural language amounts |
| `policy_keyword` | enum | `refund` | ✓ Synonyms (e.g., "get money back") |
| `requires_escalation` | boolean | Urgent language | ✓ Nuanced language detection |

## Architecture

```
User Input
    ↓
[DETERMINISTIC] Regex extraction (fast, always runs)
    ↓ (results cached)
[LLM] OpenAI API call (only for missing signals, if enabled)
    ↓ (confidence scored)
[MERGE] User signals take precedence, agent confirms
    ↓
[MANDATE] Policy evaluation with complete signal set
    ↓
[VERDICT] PAUSE | ALLOW | BLOCK | OBSERVE
```

## Files

- `llm-signal-extractor.ts` - OpenAI integration
- `interactive-chatbot-agent.ts` - Agent with LLM support
- `.env.example` - Configuration template

## Configuration

### Environment Variables

```
ENABLE_LLM_EXTRACTION    Set to "true" to enable LLM extraction
OPENAI_API_KEY          OpenAI API key (sk-...)
OPENAI_MODEL            Model to use (default: gpt-4o-mini)
```

### Cost

- **gpt-4o-mini**: ~$0.00015 per 1K tokens
- Typical request: 200-300 tokens (input + output)
- Cost per message: ~$0.00003-0.00005
- Interactive demo with 10 messages: ~$0.0005

## Error Handling

If LLM fails:
1. Deterministic extraction results are preserved
2. LLM errors are logged as warnings
3. Conversation continues without LLM
4. Automatic fallback to deterministic-only mode

```
[SIGNAL] LLM extraction failed, using deterministic only: Error: ...
```

## Security

- API key stored in `.env` (not committed to git)
- Never log full API keys
- Use `.gitignore` to exclude `.env`

```
# .gitignore
.env
.env.local
```

## Next Steps

1. **Integrate with Backend**: Wire `extractSignalsWithLLM` into `signal-populator.ts` server-side
2. **Add Caching**: Cache LLM results for identical inputs
3. **Custom Prompts**: Fine-tune extraction prompts per domain
4. **Confidence Thresholds**: Reject low-confidence extractions
5. **Other LLMs**: Support Claude, Gemini, etc.

## Troubleshooting

**"OPENAI_API_KEY is not set"**
- Set environment variable: `export OPENAI_API_KEY=sk-...`
- Or add to `.env` file

**"OpenAI API error: 401"**
- Invalid API key
- Check token at https://platform.openai.com/api/keys

**"OpenAI API error: 429"**
- Rate limited
- Wait a moment before retrying

**"LLM extraction slow"**
- Expected: ~1-2 seconds per call
- Use `gpt-4o-mini` (faster than `gpt-4`)
- Consider caching results
