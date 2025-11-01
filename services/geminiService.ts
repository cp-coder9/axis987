
import { GoogleGenAI, Type, GenerateContentParameters } from "@google/genai";
import { FloorPlanData, ElevationData, ArchitecturalElement } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const floorPlanElementSchema = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING, enum: ['wall', 'door', 'window', 'stairs'], description: "The type of architectural element." },
        // Wall & Window Props
        x1: { type: Type.NUMBER, description: "For walls/windows, the x-coordinate of the start point." },
        y1: { type: Type.NUMBER, description: "For walls/windows, the y-coordinate of the start point." },
        x2: { type: Type.NUMBER, description: "For walls/windows, the x-coordinate of the end point." },
        y2: { type: Type.NUMBER, description: "For walls/windows, the y-coordinate of the end point." },
        thickness: { type: Type.NUMBER, description: "For walls/windows, the thickness of the element." },
        // Door Props
        x: { type: Type.NUMBER, description: "For doors/stairs, the x-coordinate of the center point or top-left corner." },
        y: { type: Type.NUMBER, description: "For doors/stairs, the y-coordinate of the center point or top-left corner." },
        width: { type: Type.NUMBER, description: "For doors/stairs, the width of the element." },
        height: { type: Type.NUMBER, description: "For doors, this is the wall thickness. For stairs, it is the bounding box height." },
        angle: { type: Type.NUMBER, description: "For doors, the angle of the wall it's in (0 for horizontal, 90 for vertical)." },
        // Stairs Props
        direction: { type: Type.STRING, enum: ['horizontal', 'vertical'], description: "For stairs, the primary direction." },
    },
    required: ["type"]
};

const floorPlanResponseSchema = {
  type: Type.OBJECT,
  properties: {
    canvas: {
      type: Type.OBJECT,
      description: "The total dimensions of the canvas needed to fit all elements.",
      properties: {
        width: { type: Type.NUMBER, description: "Total width of the canvas in meters." },
        height: { type: Type.NUMBER, description: "Total height of the canvas in meters." },
      },
    },
    rooms: {
      type: Type.ARRAY,
      description: "An array of all rooms, defined by a simple bounding box for labeling and interaction purposes.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The name of the room (e.g., 'Living Room')." },
          position: {
            type: Type.OBJECT,
            description: "The top-left corner (x, y) coordinates of the room's INTERIOR bounding box in meters.",
            properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
          },
          dimensions: {
            type: Type.OBJECT,
            description: "The interior size of the room in meters.",
            properties: { width: { type: Type.NUMBER }, height: { type: Type.NUMBER } },
          },
        },
        required: ["name", "position", "dimensions"],
      },
    },
    elements: {
        type: Type.ARRAY,
        description: "An array of all detailed architectural elements for rendering the floor plan.",
        items: floorPlanElementSchema,
    },
  },
  required: ["canvas", "rooms", "elements"],
};

const elevationElementSchema = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING, description: "The type of shape: 'rect', 'line', or 'path'." },
        x: { type: Type.NUMBER, description: "For 'rect', the x-coordinate of the top-left corner." },
        y: { type: Type.NUMBER, description: "For 'rect', the y-coordinate of the top-left corner." },
        width: { type: Type.NUMBER, description: "For 'rect', the width of the rectangle." },
        height: { type: Type.NUMBER, description: "For 'rect', the height of the rectangle." },
        x1: { type: Type.NUMBER, description: "For 'line', the x-coordinate of the start point." },
        y1: { type: Type.NUMBER, description: "For 'line', the y-coordinate of the start point." },
        x2: { type: Type.NUMBER, description: "For 'line', the x-coordinate of the end point." },
        y2: { type: Type.NUMBER, description: "For 'line', the y-coordinate of the end point." },
        d: { type: Type.STRING, description: "For 'path', the SVG path data string." },
    },
    required: ["type"],
};

const elevationResponseSchema = {
  type: Type.OBJECT,
  properties: {
    canvas: {
      type: Type.OBJECT,
      description: "The total dimensions of the canvas for the elevation drawing.",
      properties: {
        width: { type: Type.NUMBER, description: "Total width of the canvas." },
        height: { type: Type.NUMBER, description: "Total height of the canvas." },
      },
    },
    layers: {
      type: Type.ARRAY,
      description: "An array of layers, each containing a group of SVG-like elements.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The name of the layer (e.g., 'Structural', 'Windows & Doors', 'Details')." },
          elements: {
            type: Type.ARRAY,
            description: "An array of SVG-like elements within this layer.",
            items: elevationElementSchema,
          },
        },
        required: ["name", "elements"],
      },
    },
  },
  required: ["canvas", "layers"],
};

interface ImagePart {
    inlineData: {
        mimeType: string;
        data: string;
    }
}

export const generateFloorPlan = async (description: string, image: ImagePart | null): Promise<FloorPlanData> => {
  const textPrompt = `
    You are an expert architect and CAD specialist. Your task is to perform a detailed trace of the provided floor plan image and convert it into a structured JSON format.

    **CRITICAL INSTRUCTIONS:**

    1.  **Identify Architectural Elements:** Trace the following elements with precision:
        *   **Walls:** Identify all structural walls. Represent each straight wall segment with a start point (x1, y1), an end point (x2, y2), and its thickness.
        *   **Windows:** Locate all windows within walls. Represent them as a line segment with a start (x1, y1), end (x2, y2), and thickness (matching the wall).
        *   **Doors:** Locate all door openings. Your 'wall' elements should have gaps where doors are located. For each door, provide its center point (x, y), its width (the opening size), its height (the wall thickness), and its angle (0 for horizontal walls, 90 for vertical walls).
        *   **Stairs:** Identify staircases and represent their bounding box (x, y, width, height) and orientation.
    2.  **Define Room Areas:** For each distinct room (e.g., 'Living Room', 'Bedroom', 'Porch'), define a simple rectangular bounding box with its top-left position (x, y) and dimensions (width, height). This is for labeling and interaction, and should represent the main internal area of the room, inside the walls.
    3.  **Coordinate System:** The origin (0,0) is at the top-left corner. All coordinates and dimensions MUST be in meters, derived from the scale and measurements in the image.
    4.  **Schema Adherence:** The final output MUST be a single, valid JSON object that strictly follows the provided schema. Do not add any markdown, comments, or explanatory text outside the JSON structure.
    5.  **User Context:** Use the optional user-provided text for critical hints: "${description}"
  `;
  
  const textPart = { text: textPrompt };
  const contents: GenerateContentParameters['contents'] = { parts: [textPart] };

  if (image) {
    contents.parts.push(image);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: floorPlanResponseSchema,
        temperature: 0.1,
      },
    });

    const jsonText = response.text.trim();
    const parsedData = JSON.parse(jsonText) as FloorPlanData;
    
    if (!parsedData.rooms || !parsedData.canvas || !parsedData.elements) {
      throw new Error("Invalid data structure received from API.");
    }

    return parsedData;
  } catch (error) {
    console.error("Error generating floor plan:", error);
    throw new Error("Failed to generate floor plan from the image. The model might have had trouble interpreting the plan. Please try a clearer image or add descriptive hints.");
  }
};

export const generateElevation = async (description: string, image: ImagePart): Promise<ElevationData> => {
  const textPrompt = `
    You are an expert architect with advanced skills in photogrammetry. Your task is to analyze the provided photograph of a building's facade and convert it into a highly accurate, simplified 2D line drawing elevation, organized into logical layers.

    **CRITICAL INSTRUCTIONS:**

    1.  **Perspective Correction:** The photo may have perspective distortion. You MUST correct for this and produce a flat, orthographic 2D elevation drawing as if viewed from an infinite distance, directly in front. All vertical lines in reality must be perfectly vertical in your drawing, and all horizontal lines perfectly horizontal.
    2.  **Maintain Proportions:** Accurately measure the relative proportions and scale of all architectural features (windows, doors, roof pitch, etc.) from the image and replicate them precisely in your drawing.
    3.  **Symmetry and Alignment:** Identify and enforce symmetry. If the building appears symmetrical, ensure that corresponding elements are identical in size and perfectly aligned. Align tops and bottoms of windows and doors where appropriate.
    4.  **Clean Geometry:** Generate clean, straight lines and perfect geometric shapes (rectangles, paths). Do not replicate photographic imperfections, lens distortion, or minor surface irregularities.
    5.  **Infer Obscured Elements:** If features like windows or doors are partially obscured by objects (e.g., trees, cars), intelligently infer and draw their complete shape based on visible parts and context.
    6.  **Identify Specific Features:** Pay close attention to and accurately represent distinct architectural styles. This includes:
        *   **Roof Style:** Identify if it's a gable, hip, mansard, flat, or other type of roof and draw its shape accordingly using a 'path' element.
        *   **Window Style:** Differentiate between window types like double-hung, casement, bay, or picture windows. Represent their frames and mullions with simple 'rect' and 'line' elements.
        *   **Facade Materials:** While you MUST ignore fine textures, represent the *form* of different materials. For example, draw the outline of stone cladding at the base or the shape of siding panels, but not the individual bricks or wood grain.
    7.  **Intelligent Layering:** Categorize every element into one of the following layers:
        *   **'Structural':** The main outline of the building, primary walls, the roofline, and the ground line.
        *   **'Windows & Doors':** All windows and doors. Represent them as simple rectangles ('rect').
        *   **'Details':** Important secondary elements like chimneys, railings, shutters, significant trim, and decorative moldings.
    8.  **Filter Out Noise:** You MUST ignore transient details like textures (brick, siding), shadows, reflections, lens flare, and external objects (people, vehicles, most vegetation unless it's a structural part of the design like a trellis).
    9.  **Canvas and Origin:** The origin (0,0) is the top-left corner. The canvas size must be calculated to fit the entire drawing with a small, sensible margin.
    10. **Schema Adherence:** The final output MUST be a single, valid JSON object that strictly follows the provided schema. Do not include any markdown, comments, or explanatory text outside the JSON structure. Failure to comply will result in an error.
    11. **User Context:** Use the optional user-provided text for critical hints: "${description}"
  `;

  const textPart = { text: textPrompt };
  const contents: GenerateContentParameters['contents'] = { parts: [textPart, image] };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: elevationResponseSchema,
        temperature: 0.2,
      },
    });

    const jsonText = response.text.trim();
    const parsedData = JSON.parse(jsonText) as ElevationData;

    if (!parsedData.layers || !parsedData.canvas) {
      throw new Error("Invalid data structure received from API for elevation.");
    }

    return parsedData;
  } catch (error) {
    console.error("Error generating elevation:", error);
    throw new Error("Failed to generate elevation from the photo. The model might have had trouble interpreting the image. Please try a clearer, front-facing photo.");
  }
};
