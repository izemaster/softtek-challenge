import { WeatherData } from "./OpenMeteorTypes";
import { CharacterData, CharacterResponse, PlanetData, PlanetResponse } from "./SwapiTypes";
import express, { Request, Response } from "express";
import serverless from "serverless-http";
import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const app = express();

const USERS_TABLE = process.env.USERS_TABLE;
const FUSION_HISTORY_TABLE = process.env.FUSION_HISTORY_TABLE;
const API_CACHE_TABLE = process.env.API_CACHE_TABLE || 'API_CACHE_TABLE';

const isTest = !!process.env.JEST_WORKER_ID;
const testDdbConfig: DynamoDBClientConfig = {
  region: 'local-env',
  endpoint: 'http://localhost:8000',
  tls: false,
  }

const client = new DynamoDBClient(!isTest ? {} : testDdbConfig);
const docClient = DynamoDBDocumentClient.from(client);

app.use(express.json());
const swapiUrl = 'https://www.swapi.tech/api'
const openMeteoUrl = 'https://api.open-meteo.com'
const planetCoordinates: Record<string, { latitude: number; longitude: number }> = {
  Tatooine: { latitude: 30.0, longitude: 10.0 },
  Alderaan: { latitude: 45.0, longitude: -120.0 },
  Hoth: { latitude: 75.0, longitude: -100.0 },
  Naboo: { latitude: -10.0, longitude: 120.0 },
  Endor: { latitude: 50.0, longitude: -80.0 },
};

type CompositeCharacterWeather = CharacterData & {
  planet: {
    data: PlanetData,
    weather: WeatherData | undefined
  }
}

async function cachePut(cacheKey: string, data: any) {
  const ttl = Math.floor(Date.now() / 1000) + 1800;

  await docClient.send(
    new PutCommand({
      TableName: API_CACHE_TABLE,
      Item: {
        cacheKey,
        data,
        ttl, 
      },
    })
  );
}

async function cachedGet(cacheKey: string): Promise<any | null> {
  const response = await docClient.send(
    new GetCommand({
      TableName: API_CACHE_TABLE,
      Key: { cacheKey },
    })
  );
  return response.Item?.data || null;
}

async function getWeather(planetName: string): Promise<WeatherData | undefined> {
  const coords = planetCoordinates[planetName];
  if (!coords) return undefined;

  const cacheKey = `weather-${planetName}`;
  const cached = await cachedGet(cacheKey);
  if (cached) return cached;

  const queryParams = new URLSearchParams({
    latitude: coords.latitude.toString(),
    longitude: coords.longitude.toString(),
    hourly: "temperature_2m",
    timezone: "America/New_York",
    forecast_days: "1",
  });
  try {
    const response = await fetch(`${openMeteoUrl}/v1/forecast?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch weather: ${response.status}`);
    }
    const data = await response.json() as WeatherData;
    await cachePut(cacheKey, data);

    return data;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

async function getCharacter(id: string): Promise<CharacterData | undefined> {
  try {
    const cacheKey = `swapi-people-${id}`;
    const cached = await cachedGet(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${swapiUrl}/people/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch character: ${response.status}`);
    }
    
    const data = await response.json() as CharacterResponse;
    await cachePut(cacheKey, data.result);

    return data.result;
  } catch (error) {
      console.error(error);
      return undefined;
  }
}

async function getPlanet(url: string): Promise<PlanetData | undefined> {
  try {
    const cacheKey = `swapi-planet-${url}`;
    const cached = await cachedGet(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${url}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch planet: ${response.status}`);
    }
    
    const data = await response.json() as PlanetResponse;
    await cachePut(cacheKey, data.result);

    return data.result;
  } catch (error) {
      console.error(error);
      return undefined;
  }
}

app.get('/fusionados/:id', async (req: Request, res: Response) => {
  const character = await getCharacter(req.params.id);
  if (!character) return res.status(404).json({ error: "Character not found" });

  const planet = await getPlanet(character.properties.homeworld);
  if (!planet) return res.status(404).json({ error: "Planet not found" });

  const weather = await getWeather(planet.properties.name);

  const responseData: CompositeCharacterWeather = {
    ...character,
    planet: {
      data: planet,
      weather: weather
    }
  }

  const params = {
    TableName: FUSION_HISTORY_TABLE,
    Item: { fusionId: randomUUID(), createdAt: Date.now(), responseData },
  };

  try {
    const command = new PutCommand(params);
    await docClient.send(command);
    res.json(responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create history" });
  }

  
});

app.post('/almacenar', async (req: Request, res: Response) => {
  const { userId, name } = req.body;
  if (typeof userId !== "string") {
    return res.status(400).json({ error: '"userId" must be a string' });
  } else if (typeof name !== "string") {
    return res.status(400).json({ error: '"name" must be a string' });
  }

  const params = {
    TableName: USERS_TABLE,
    Item: { userId, name },
  };

  try {
    const command = new PutCommand(params);
    await docClient.send(command);
    res.json({ userId, name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create user" });
  }
});

app.get('/historial/:page', async (req: Request, res: Response) => {
  const page = parseInt(req.params.page);
  const limit = 10;

  if (isNaN(page) || page < 1) {
    return res.status(400).json({ error: "Invalid page number" });
  }

  try {
    const result = await docClient.send(new ScanCommand({
      TableName: FUSION_HISTORY_TABLE,
    }));

    const items = (result.Items || []).sort((a, b) => b.createdAt - a.createdAt);

    const start = (page - 1) * limit;
    const end = start + limit;

    const paginatedItems = items.slice(start, end);

    res.json({
      page,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / limit),
      items: paginatedItems,
    });
  } catch (error) {
    console.error("Scan error:", error);
    res.status(500).json({ error: "Could not retrieve history" });
  }
});

app.get("/users/:userId", async (req: Request, res: Response) => {
  const params = {
    TableName: USERS_TABLE,
    Key: {
      userId: req.params.userId,
    },
  };

  try {
    const command = new GetCommand(params);
    const { Item } = await docClient.send(command);
    if (Item) {
      const { userId, name } = Item;
      res.json({ userId, name });
    } else {
      res
        .status(404)
        .json({ error: 'Could not find user with provided "userId"' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not retrieve user" });
  }
});

app.use((req: Request, res: Response) => {
  return res.status(404).json({
    error: "Not Found",
  });
});
export { app };
export { getWeather };
exports.handler = serverless(app);
