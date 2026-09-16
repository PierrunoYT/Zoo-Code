import { ClineMessage, HistoryItem } from "@roo-code/types"
import { act, renderHook } from "@testing-library/react"

import { usePromptHistory } from "../usePromptHistory"

describe("usePromptHistory", () => {
	it("resets navigation when switching to conversation history with identical prompts", () => {
		const prompt = "Explain this code"
		const taskHistory: HistoryItem[] = [
			{
				id: "task-1",
				number: 1,
				ts: 1,
				task: prompt,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
				workspace: "/workspace",
			},
		]
		const conversationHistory: ClineMessage[] = [{ ts: 2, type: "say", say: "user_feedback", text: prompt }]
		const setInputValue = vi.fn()

		const { result, rerender } = renderHook<
			ReturnType<typeof usePromptHistory>,
			{ clineMessages: ClineMessage[] | undefined }
		>(
			({ clineMessages }) =>
				usePromptHistory({
					clineMessages,
					taskHistory,
					cwd: "/workspace",
					inputValue: "draft",
					setInputValue,
				}),
			{ initialProps: { clineMessages: undefined } },
		)

		act(() => {
			result.current.setHistoryIndex(0)
			result.current.setTempInput("draft")
		})

		expect(result.current.promptHistory).toEqual([prompt])
		expect(result.current.historyIndex).toBe(0)
		expect(result.current.tempInput).toBe("draft")

		rerender({ clineMessages: conversationHistory })

		expect(result.current.promptHistory).toEqual([prompt])
		expect(result.current.historyIndex).toBe(-1)
		expect(result.current.tempInput).toBe("")
	})
})
