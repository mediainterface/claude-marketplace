# Implement Command

You are tasked with implementing a plan Step-by-Step in an organized and methodical fashion. Follow
these steps:

## Implementation Process

1. **Load the Plan**: First, look for the plan and read it
2. **Set Up Tracking**: Use the TodoWrite tool to create a todo list based on the plan's
   implementation tasks
3. **Implement Step-by-Step**: Work through each task systematically:
    - Mark current task as in_progress
    - Implement the task completely (use the most appropriate subagent)
    - Test the implementation if applicable
    - You MUST update the plan as you go
    - Mark task as completed before moving to next
4. **Validate Progress**: After each major task, ensure the implementation works as expected

## Implementation Guidelines

- **Follow the Plan**: Stick to the tasks outlined in the plan unless you discover issues that
  require deviation
- **One Task at a Time**: Only work on one task at a time, completing it fully before moving on
- **Orchestration First**: Orchestrate implementation tasks to the appropriate subagent, don't write
  code yourself
- **Test as You Go**: Run tests, lints, and basic validation after each significant change
- **Update Documentation**: Keep any relevant documentation updated as you implement
- **Handle Blockers**: If you encounter issues not anticipated in the plan, create additional todos
  to track resolution
- **Keep Track**: Use the plan as a living document, updating as needed

## Task Management

- Use TodoWrite tool to track all implementation tasks
- Mark tasks as in_progress when starting work
- Mark tasks as completed immediately after finishing
- Add new tasks if you discover additional work needed
- Break down large tasks into smaller ones if needed

## Quality Assurance

- Make sure the code builds after code changes
- Execute relevant tests to ensure nothing breaks
- Follow existing code patterns and conventions
- Ensure proper error handling and edge case coverage

## Communication

- Keep the user informed of progress without being verbose
- Report any deviations from the original plan and why
- Ask for clarification if plan details are unclear
- Summarize what was accomplished at the end

---

**Plan to implement**: {{ARGS}}

If no plan name is provided, ask the user to specify which plan to implement.
Then implement the plan following the step-by-step process above.