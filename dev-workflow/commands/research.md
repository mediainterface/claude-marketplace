---
model: claude-opus-4-5
---

# Research Command

You are tasked with conducting comprehensive research on the given topic. Your goal is to gather,
analyze, and synthesize information into a well-structured research document. Follow these steps:

## Research Process

1. **Understand the Request**: Analyze the user's input to identify:
    - Core research topic
    - Specific aspects to investigate
    - Scope and boundaries of research
    - Expected depth of analysis

2. **Gather Information**:
    - Search the codebase for relevant implementations and patterns
    - Use web search to find current best practices and documentation
    - Explore multiple perspectives and approaches
    - Collect technical specifications and requirements
    - Identify relevant libraries, frameworks, and tools

3. **Analyze and Synthesize**:
    - Compare different approaches and solutions
    - Identify trade-offs and considerations
    - Evaluate feasibility and compatibility
    - Extract key insights and patterns
    - Determine practical recommendations

4. **Document Findings**: Save the research to `.claude/research/{TOPIC_NAME}.md` where TOPIC_NAME
   is a descriptive name based on the research topic

5. **Present Summary**: After writing the research document:
    - Present key findings to the user
    - Highlight important discoveries
    - Note any areas requiring further investigation
    - Suggest next steps (often proceeding to `/plan`)

## Research Document Structure

Your research document should follow this markdown structure:

```markdown
# Research: [Topic Title]

## Executive Summary
Brief overview of research findings and key recommendations (2-3 paragraphs)

## Research Scope
- What was researched
- What was explicitly excluded
- Research methodology used

## Current State Analysis
### Existing Implementation
- Current codebase patterns and practices
- Relevant existing components
- Technical debt and limitations

### Industry Standards
- Best practices and patterns
- Common approaches
- Recent developments

## Technical Analysis

### Approach 1: [Name]
- **Description**: Brief explanation
- **Pros**: Benefits and strengths
- **Cons**: Drawbacks and limitations
- **Use Cases**: When to use this approach
- **Code Example**: If applicable

### Approach 2: [Name]
- **Description**: Brief explanation
- **Pros**: Benefits and strengths
- **Cons**: Drawbacks and limitations
- **Use Cases**: When to use this approach
- **Code Example**: If applicable

### Approach 3: [Name]
- **Description**: Brief explanation
- **Pros**: Benefits and strengths
- **Cons**: Drawbacks and limitations
- **Use Cases**: When to use this approach
- **Code Example**: If applicable

## Tools and Libraries

### Option 1: [Library/Tool Name]
- **Purpose**: What it does
- **Maturity**: Production-ready/Beta/Experimental
- **License**: License type
- **Community**: Size and activity
- **Integration Effort**: Low/Medium/High
- **Key Features**: Relevant capabilities

### Option 2: [Library/Tool Name]
- **Purpose**: What it does
- **Maturity**: Production-ready/Beta/Experimental
- **License**: License type
- **Community**: Size and activity
- **Integration Effort**: Low/Medium/High
- **Key Features**: Relevant capabilities

## Implementation Considerations

### Technical Requirements
- Dependencies and prerequisites
- Performance implications
- Scalability considerations
- Security aspects

### Integration Points
- How it fits with existing architecture
- Required modifications
- API changes needed
- Database impacts

### Risks and Mitigation
- Potential challenges
- Risk mitigation strategies
- Fallback options

## Recommendations

### Recommended Approach
- Primary recommendation with reasoning
- Alternative approach if constraints change
- Phased implementation strategy

## References
- Links to documentation
- Relevant articles and resources
- Code repositories
- API references

## Appendix
### Additional Notes
- Observations during research
- Questions for further investigation
- Related topics worth exploring
```

## Research Guidelines

- **Be Thorough**: Explore multiple sources and perspectives
- **Stay Focused**: Keep research relevant to the specific request
- **Be Objective**: Present pros and cons fairly
- **Provide Evidence**: Support findings with concrete examples
- **Think Practically**: Focus on implementable solutions
- **Consider Context**: Account for existing codebase and constraints
- **Document Sources**: Reference where information was found
- **Highlight Unknowns**: Note areas needing further investigation

## Information Gathering Techniques

- **Codebase Analysis**: Use Grep, Glob, and Read to understand existing patterns
- **Web Research**: Use WebSearch for documentation, best practices, and recent developments
- **Library Exploration**: Research available libraries using context7 or web sources
- **Pattern Recognition**: Identify common solutions across multiple sources
- **Comparative Analysis**: Evaluate trade-offs between different approaches

## Quality Checklist

Before finalizing research:

- ✓ All requested aspects have been investigated
- ✓ Multiple approaches have been considered
- ✓ Recommendations are practical and justified
- ✓ Document is well-structured and easy to navigate
- ✓ Key findings are clearly highlighted
- ✓ Next steps are actionable

---

**Research Topic**: {{ARGS}}

Conduct comprehensive research on the above topic following the guidelines above.