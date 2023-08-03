import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/modules/trpc/trpc.server';
import { historySchema, httpPOSTorTRPCError, listModelsOutputSchema, ModelDescriptionSchema, modelSchema, openAIChatCompletionPayload } from '~/modules/llms/openai/openai.router';
import { OpenAI } from '~/modules/llms/openai/openai.types';
import { TRPCError } from '@trpc/server';


// input schemas

const azureAccessSchema = z.object({
  azureKey: z.string().trim(),
  azureHost: z.string().trim(),
});

const chatGenerateSchema = z.object({ access: azureAccessSchema, model: modelSchema, history: historySchema });

const listModelsSchema = z.object({ access: azureAccessSchema });


// Output Schemas

const chatGenerateOutputSchema = z.object({
  role: z.enum(['assistant', 'system', 'user']),
  content: z.string(),
  finish_reason: z.union([z.enum(['stop', 'length']), z.null()]),
});


// Wire schemas

const dataSchema = z.object({
  // object: z.literal('model'),
  id: z.string(),
  status: z.string(),
  lifecycle_status: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
  // capabilities: z.object({
  //   fine_tune: z.boolean(),
  //   inference: z.boolean(),
  //   completion: z.boolean(),
  //   chat_completion: z.boolean(),
  //   embeddings: z.boolean(),
  // }),
  deprecation: z.object({
    // fine_tune: z.number().optional(),
    inference: z.number(),
  }),
});

const wireAzureListModelsSchema = z.object({
  // object: z.literal('list'),
  data: z.array(dataSchema),
});


export const llmAzureRouter = createTRPCRouter({

  /**
   * Chat-based message generation
   */
  chatGenerate: publicProcedure
    .input(chatGenerateSchema)
    .output(chatGenerateOutputSchema)
    .mutation(async ({ input }) => {

      const { access, model, history } = input;

      const wireCompletions = await azureOpenAIPOST<OpenAI.Wire.ChatCompletion.Request, OpenAI.Wire.ChatCompletion.Response>(
        access.azureKey, access.azureHost,
        openAIChatCompletionPayload(model, history, null, 1, false),
        '/v1/chat/completions',
      );

      // expect a single output
      if (wireCompletions?.choices?.length !== 1)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `[OpenAI Issue] Expected 1 completion, got ${wireCompletions?.choices?.length}` });
      let { message, finish_reason } = wireCompletions.choices[0];

      // LocalAI hack/workaround, until https://github.com/go-skynet/LocalAI/issues/788 is fixed
      if (finish_reason === undefined)
        finish_reason = 'stop';

      // check for a function output
      // return parseChatGenerateOutput(message as OpenAI.Wire.ChatCompletion.ResponseMessage, finish_reason);
      return {
        role: 'assistant',
        content: 'TESTXXX',
        finish_reason: finish_reason as 'stop' | 'length',
      }
    }),


  /**
   * List the Azure models
   */
  listModels: publicProcedure
    .input(listModelsSchema)
    .output(listModelsOutputSchema)
    .query(async ({ input }) => {

      // fetch the Azure OpenAI models
      const azureApiVersion = '2023-05-15';
      const azureModels = await azureOpenaiGET(
        input.access.azureKey, input.access.azureHost,
        `/openai/models?api-version=${azureApiVersion}`,
      );

      // take the GPT models
      let models = wireAzureListModelsSchema.parse(azureModels).data;
      models = models.filter(model => model.id.includes('gpt'));

      // remove models with duplicate ids (happens on Azure - same model, different versions?)
      const preFilterCount = models.length;
      models = models.filter((model, index) => models.findIndex(m => m.id === model.id) === index);
      if (preFilterCount !== models.length)
        console.warn(`openai.router.listAzureModels: Duplicate model ids found, removed ${preFilterCount - models.length} models`);

      // output
      return {
        models: models.map(azureModelToModelDescription),
      };
    }),

});


// this will help with adding metadata to the models
const knownAzureModels = [
  {
    id: 'gpt-35-turbo',
    label: '3.5-Turbo',
    context: 4097,
    description: 'Fair speed and smarts',
  },
  {
    id: 'gpt-35-turbo-16k',
    label: '3.5-Turbo-16k',
    context: 16384,
    description: 'Fair speed and smarts, large context',
  },
  {
    id: 'gpt-4',
    label: 'GPT-4',
    context: 8192,
    description: 'Insightful, big thinker, slower, pricey',
  },
  {
    id: 'gpt-4-32k',
    label: 'GPT-4-32k',
    context: 32768,
    description: 'Largest context window for big problems',
  },
];


function azureModelToModelDescription(model: { id: string, created_at: number, updated_at: number }): ModelDescriptionSchema {
  const knownModel = knownAzureModels.find(m => m.id === model.id);
  return {
    id: model.id,
    label: knownModel?.label || model.id,
    created: model.created_at,
    updated: model.updated_at || model.created_at,
    description: knownModel?.description || 'Unknown model type, please let us know',
    contextWindow: knownModel?.context || 2048,
    hidden: !knownModel,
  };
}


async function azureOpenaiGET<TOut>(key: string, endpoint: string, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = azureOpenAIAccess(key, endpoint, apiPath);
  const response = await fetch(url, { headers });
  return await response.json() as TOut;
}

async function azureOpenAIPOST<TBody, TOut>(key: string, endpoint: string, body: TBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = azureOpenAIAccess(key, endpoint, apiPath);
  return await httpPOSTorTRPCError<TBody, TOut>(url, headers, body, 'Azure');
}

function azureOpenAIAccess(key: string, endpoint: string, apiPath: string): { headers: HeadersInit, url: string } {
  // API key
  const azureKey = key || process.env.AZURE_OPENAI_API_KEY || '';

  // API endpoint
  let azureHost = endpoint || process.env.AZURE_OPENAI_API_HOST || '';
  if (!azureHost.startsWith('http'))
    azureHost = `https://${azureHost}`;
  if (azureHost.endsWith('/') && apiPath.startsWith('/'))
    azureHost = azureHost.slice(0, -1);

  // warn if no key - only for default (non-overridden) hosts
  if (!azureKey || !azureHost)
    throw new Error('Missing Azure API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).');

  return {
    headers: {
      ...(azureKey && { 'api-key': azureKey }),
      'Content-Type': 'application/json',
    },
    url: azureHost + apiPath,
  };
}
