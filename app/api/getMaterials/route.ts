import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { useSearchParams } from "next/navigation";

export async function GET(request: NextRequest) {
  const item = request.nextUrl.searchParams.get("item");
  try {
    const key = process.env.REPLICATE_TOKEN as string;
    const API_URL =
      "https://api.replicate.com/v1/models/meta/meta-llama-3-70b-instruct/predictions";
    const prompt = `What is a ${item} made out of. Nothing else, just list the materials, minimum of 2 materials, maximum of 2 materials. One sentence response with JUST the materials listed separated with the word and, no other words.`;
    const prompt_template =
      "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are a helpful assistant<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n";

    interface ReplicatePrompt {
      stream: boolean;
      input: {
        prompt: string;
        prompt_template: string;
      };
    }

    interface ReplicateResponse {
      urls: {
        stream: string;
      };
    }

    const data: ReplicatePrompt = {
      stream: false,
      input: {
        prompt,
        prompt_template,
      },
    };
    const replicateResponse = await axios.post(API_URL, data, {
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_TOKEN}`,
      },
    });
    const getUrl = replicateResponse.data.urls.get;
    const getOutput = async () => {
      const pollResponse = await axios.get(getUrl, {
        headers: { Authorization: `Bearer ${process.env.REPLICATE_TOKEN}` },
      });

      if (pollResponse.status !== 200) {
        throw new Error(`Request failed: ${pollResponse.status}`);
      }

      const pollData = pollResponse.data;
      if (pollData.status === "succeeded") {
        return pollData.output;
      } else if (
        pollData.status === "failed" ||
        pollData.status === "canceled"
      ) {
        throw new Error(`Prediction failed or canceled: ${pollData.status}`);
      } else {
        return null;
      }
    };

    let output: string | null = null;
    while (!output) {
      try {
        output = await getOutput();
      } catch (error) {
        console.error(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    let format: string = output.toString();
    format=format.replace(/,/g,"");
    return new NextResponse(format);
  } catch (error) {
    // baritra can you make a new terminal and share it wiht me
    //  do you have access to terminal     i did, do you have it
    // yes make yourself one and share that with me as well
    console.error(error);
    return new NextResponse("An error occurred. :((");
  }
}
