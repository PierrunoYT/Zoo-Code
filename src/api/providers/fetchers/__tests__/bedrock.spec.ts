import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock"
import { fromIni } from "@aws-sdk/credential-providers"
import { getBedrockCatalog } from "../bedrock"

const { send, destroy, pages } = vi.hoisted(() => ({ send: vi.fn(), destroy: vi.fn(), pages: vi.fn() }))
vi.mock("@aws-sdk/client-bedrock", () => ({
	BedrockClient: vi.fn().mockImplementation(function () {
		return { send, destroy }
	}),
	ListFoundationModelsCommand: vi.fn(),
	paginateListInferenceProfiles: (...args: unknown[]) => pages(...args),
}))
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => "profile-provider") }))
vi.mock("../../../../utils/networkProxy", () => ({ getSystemProxyUrl: () => undefined }))

beforeEach(() => {
	vi.clearAllMocks()
})

it("uses the selected region and credentials, and includes every profile page with explicit routing labels", async () => {
	send.mockResolvedValue({
		modelSummaries: [
			{ modelArn: "foundation-new", modelName: "New model", responseStreamingSupported: true },
			{ modelArn: "no-stream", responseStreamingSupported: false },
		],
	})
	pages.mockImplementation(async function* () {
		yield {
			inferenceProfileSummaries: [
				{
					inferenceProfileArn: "geo",
					inferenceProfileId: "eu.model",
					status: "ACTIVE",
					type: "SYSTEM_DEFINED",
				},
			],
		}
		yield {
			inferenceProfileSummaries: [
				{
					inferenceProfileArn: "world",
					inferenceProfileId: "global.model",
					status: "ACTIVE",
					type: "SYSTEM_DEFINED",
				},
				{
					inferenceProfileArn: "app",
					inferenceProfileId: "application",
					status: "ACTIVE",
					type: "APPLICATION",
				},
				{ inferenceProfileArn: "inactive", status: "CREATING" },
			],
		}
	})
	const result = await getBedrockCatalog({
		awsRegion: "eu-west-3",
		awsAccessKey: "key",
		awsSecretKey: "secret",
		awsSessionToken: "session",
	})
	expect(BedrockClient).toHaveBeenCalledWith(
		expect.objectContaining({
			region: "eu-west-3",
			credentials: { accessKeyId: "key", secretAccessKey: "secret", sessionToken: "session" },
		}),
	)
	expect(ListFoundationModelsCommand).toHaveBeenCalledWith({ byOutputModality: "TEXT", byInferenceType: "ON_DEMAND" })
	expect(result).toHaveLength(4)
	expect(result).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ arn: "foundation-new", kind: "regional" }),
			expect.objectContaining({ arn: "geo", kind: "geographic" }),
			expect.objectContaining({ arn: "world", kind: "global" }),
			expect.objectContaining({ arn: "app", kind: "application" }),
		]),
	)
	expect(destroy).toHaveBeenCalledOnce()
})

it("uses a profile and releases the client on permission failure without fabricating availability", async () => {
	send.mockRejectedValue(new Error("AccessDenied"))
	await expect(
		getBedrockCatalog({ awsRegion: "us-east-1", awsUseProfile: true, awsProfile: "work" }),
	).rejects.toThrow("AccessDenied")
	expect(fromIni).toHaveBeenCalledWith({ profile: "work", ignoreCache: true })
	expect(BedrockClient).toHaveBeenCalledWith(expect.objectContaining({ credentials: "profile-provider" }))
	expect(destroy).toHaveBeenCalledOnce()
})

it("does not silently use the default credential chain when API-key authentication is selected", async () => {
	await expect(getBedrockCatalog({ awsRegion: "eu-west-3", awsUseApiKey: true })).rejects.toThrow("IAM credentials")
	expect(BedrockClient).not.toHaveBeenCalled()
})
