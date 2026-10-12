import { describe, it, expect, vi } from "vitest"
import { getCheckpointService } from "../index"

vi.mock("vscode", () => ({
	window: { showWarningMessage: vi.fn(), createTextEditorDecorationType: vi.fn(() => ({})) },
	env: {},
	Uri: {},
}))
vi.mock("@roo-code/telemetry", () => ({ TelemetryService: { instance: {} } }))
vi.mock("../../../utils/path", () => ({ getWorkspacePath: vi.fn(() => "/ws") }))
vi.mock("../../../utils/git", () => ({ checkGitInstalled: vi.fn().mockResolvedValue(true) }))
vi.mock("../../../i18n", () => ({ t: (k: string) => k }))
vi.mock("../../../services/checkpoints")

describe("repro: init failure disables checkpoints for the whole task", () => {
	it("does not retry after one initShadowGit failure", async () => {
		const { RepoPerTaskCheckpointService } = await import("../../../services/checkpoints")
		const initShadowGit = vi.fn().mockRejectedValue(new Error("simulated git failure"))
		vi.mocked(RepoPerTaskCheckpointService.create).mockReturnValue({ on: vi.fn(), initShadowGit } as never)

		const task = {
			taskId: "t",
			enableCheckpoints: true,
			checkpointTimeout: 60,
			checkpointService: undefined,
			checkpointServiceInitializing: false,
			providerRef: {
				deref: () => ({
					context: { globalStorageUri: { fsPath: "/s" } },
					log: vi.fn(),
					postMessageToWebview: vi.fn(),
				}),
			},
		}

		await getCheckpointService(task as never)
		console.log("after 1st:", {
			enable: task.enableCheckpoints,
			svcSet: !!task.checkpointService,
			initializing: task.checkpointServiceInitializing,
		})
		const second = await getCheckpointService(task as never)
		const third = await getCheckpointService(task as never)

		expect(initShadowGit).toHaveBeenCalledTimes(1)
		expect(task.enableCheckpoints).toBe(false)
		expect(second).toBeUndefined()
		expect(third).toBeUndefined()
	})
})
