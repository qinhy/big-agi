import { DLLM, ModelVendor } from '../llm.types';

import { LLMOptionsOpenAI } from '~/modules/llms/openai/openai.vendor';
import { OpenAILLMOptions } from '~/modules/llms/openai/OpenAILLMOptions';

import { AzureIcon } from './AzureIcon';
import { AzureSourceSetup } from './AzureSourceSetup';
import { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '~/modules/llms/llm.client';
import { apiAsync } from '~/modules/trpc/trpc.client';


// special symbols
export const hasServerKeyAzure = !!process.env.HAS_SERVER_KEY_AZURE_OPENAI;
export const isValidAzureApiKey = (apiKey?: string) => !!apiKey && apiKey.length >= 32;


export interface SourceSetupAzure {
  azureKey: string;
  azureHost: string;
}

export const ModelVendorAzure: ModelVendor<SourceSetupAzure, LLMOptionsOpenAI> = {
  id: 'azure',
  name: 'Azure',
  rank: 14,
  location: 'cloud',
  instanceLimit: 1,

  // components
  Icon: AzureIcon,
  SourceSetupComponent: AzureSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  normalizeSetup: (partialSetup?: Partial<SourceSetupAzure>): SourceSetupAzure => ({
    azureKey: '',
    azureHost: '',
    ...partialSetup,
  }),
  callChat: (llm: DLLM<LLMOptionsOpenAI>, messages: VChatMessageIn[], maxTokens?: number) => {
    return azureCallChatOverloaded<VChatMessageOut>(llm, messages, null, maxTokens);
  },
  callChatWithFunctions: () => {
    throw new Error('Azure does not support functions');
  },
};


/**
 * This function either returns the LLM message, or function calls, or throws a descriptive error string
 */
async function azureCallChatOverloaded<TOut = VChatMessageOut | VChatMessageOrFunctionCallOut>(
  llm: DLLM<LLMOptionsOpenAI>, messages: VChatMessageIn[], functions: VChatFunctionIn[] | null, maxTokens?: number,
): Promise<TOut> {
  // access params (source)
  const azureSetup = ModelVendorAzure.normalizeSetup(llm._source.setup as Partial<SourceSetupAzure>);

  // model params (llm)
  const { llmRef, llmTemperature = 0.5, llmResponseTokens } = llm.options;

  try {
    return await apiAsync.llmAzure.chatGenerate.mutate({
      access: azureSetup,
      model: {
        id: llmRef!,
        temperature: llmTemperature,
        maxTokens: maxTokens || llmResponseTokens || 1024,
      },
      // functions: functions ?? undefined,
      history: messages,
    }) as TOut;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'OpenAI Chat Fetch Error';
    console.error(`openAICallChat: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}