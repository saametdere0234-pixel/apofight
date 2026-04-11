'use server';
/**
 * @fileOverview A Genkit flow for generating fun and unique player names.
 *
 * - generatePlayerName - A function that generates a player name.
 * - GeneratePlayerNameInput - The input type for the generatePlayerName function.
 * - GeneratePlayerNameOutput - The return type for the generatePlayerName function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePlayerNameInputSchema = z.object({});
export type GeneratePlayerNameInput = z.infer<typeof GeneratePlayerNameInputSchema>;

const GeneratePlayerNameOutputSchema = z.object({
  name: z.string().describe('A fun and unique player name, e.g., coolpizza22, movingpineapple17, imonthecashout98.').regex(/^[a-zA-Z0-9]+$/).min(5).max(20),
});
export type GeneratePlayerNameOutput = z.infer<typeof GeneratePlayerNameOutputSchema>;

export async function generatePlayerName(input: GeneratePlayerNameInput): Promise<GeneratePlayerNameOutput> {
  return generatePlayerNameFlow(input);
}

const generatePlayerNamePrompt = ai.definePrompt({
  name: 'generatePlayerNamePrompt',
  input: {schema: GeneratePlayerNameInputSchema},
  output: {schema: GeneratePlayerNameOutputSchema},
  prompt: `You are an AI assistant that generates fun, unique, and creative player names for an online multiplayer arena combat game. The names should be a single word or a combination of words followed by numbers, without spaces or special characters. They should be between 5 and 20 characters long.

Examples:
coolpizza22
movingpineapple17
imonthecashout98
shadowstrike77
darkmatterx5
galacticgrunt01
vaporwavevixen84
ironcladking12
speeddemon99

Generate one such player name.`,
});

const generatePlayerNameFlow = ai.defineFlow(
  {
    name: 'generatePlayerNameFlow',
    inputSchema: GeneratePlayerNameInputSchema,
    outputSchema: GeneratePlayerNameOutputSchema,
  },
  async input => {
    const {output} = await generatePlayerNamePrompt(input);
    return output!;
  }
);
