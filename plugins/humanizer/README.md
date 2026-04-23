# Humanizer Plugin for Claude Code

Claude Code skill for identifying and removing AI writing patterns to make text sound more natural and human. Based on Wikipedia's "Signs of AI writing" page.

## Source

This plugin packages the [Humanizer](https://github.com/blader/humanizer) skill by [blader](https://github.com/blader).

## How it works

The plugin provides a single skill that acts as a writing editor. Give it AI-generated (or AI-sounding) text and it will:

1. Identify AI writing patterns (29 documented pattern categories)
2. Rewrite problematic sections with natural alternatives
3. Run a self-audit pass to catch remaining tells
4. Optionally match your personal writing voice from a sample

## Pattern categories

- Content patterns (significance inflation, promotional language, vague attributions)
- Language and grammar (overused AI vocabulary, copula avoidance, synonym cycling)
- Style patterns (em dash overuse, boldface overuse, emoji decoration)
- Communication patterns (chatbot artifacts, sycophantic tone)
- Filler and hedging (filler phrases, excessive hedging, generic conclusions)

## License

MIT — see [LICENSE](LICENSE). Original work by [Siqi Chen](https://github.com/blader).
