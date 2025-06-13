import {describe, expect, test} from '@jest/globals';
import {getCharacter, getPlanet, getWeather} from './src/handler';

const {DocumentClient} = require('aws-sdk/clients/dynamodb');

const isTest = process.env.JEST_WORKER_ID;
const config = {
  convertEmptyValues: true,
  ...(isTest && {
    endpoint: 'localhost:8000',
    sslEnabled: false,
    region: 'local-env',
  }),
};

const ddb = new DocumentClient(config);

const TABLE = 'API_CACHE_TABLE';


describe('getWeather fetch and DynamoDB cache', () => {
  test('should fetch weather data and store it in DynamoDB', async () => {
    const planet = 'Tatooine';
    const cacheKey = `weather-${planet}`;

    await ddb.delete({ TableName: TABLE, Key: { cacheKey } }).promise();

    const result = await getWeather(planet);

    expect(result).toHaveProperty('hourly');

    const { Item } = await ddb
      .get({ TableName: TABLE, Key: { cacheKey } })
      .promise();

    expect(Item).toBeDefined();
    expect(Item?.data).toEqual(result);
  });

  test('should use DB cached value to avoid a second call', async () => {
    const planet = 'Tatooine';
    const cacheKey = `weather-${planet}`;

    const cached = await getWeather(planet);

    const { Item } = await ddb
      .get({ TableName: TABLE, Key: { cacheKey } })
      .promise();

    expect(Item?.data).toEqual(cached);
  });
});

describe('getCharacter fetch and DynamoDB cache', () => {
  const id       = '1';
  const cacheKey = `swapi-people-${id}`;

  test('should fetch character data and store it in DynamoDB', async () => {
    
    await ddb.delete({TableName: TABLE, Key: {cacheKey}}).promise();

    const result = await getCharacter(id);

    expect(result).toHaveProperty('properties');
    expect(result?.properties).toHaveProperty('name');
    expect(result?.properties.name).toBe('Luke Skywalker');

    const {Item} = await ddb.get({TableName: TABLE, Key: {cacheKey}}).promise();
    expect(Item).toBeDefined();
    expect(Item?.data).toEqual(result);
  });

  test('should use DB cached value to avoid a second call', async () => {
    const cachedResult = await getCharacter(id); 

    const {Item} = await ddb.get({TableName: TABLE, Key: {cacheKey}}).promise();
    expect(Item?.data).toEqual(cachedResult);
  });
});

describe('getPlanet fetch and DynamoDB cache', () => {
  const url      = 'https://www.swapi.tech/api/planets/1';
  const cacheKey = `swapi-planet-${url}`;

  test('should fetch planet data and store it in DynamoDB', async () => {
    await ddb.delete({TableName: TABLE, Key: {cacheKey}}).promise();

    const result = await getPlanet(url);

    expect(result).toHaveProperty('properties');
    expect(result?.properties).toHaveProperty('name');
    expect(result?.properties?.name).toBe('Tatooine');

    const {Item} = await ddb.get({TableName: TABLE, Key: {cacheKey}}).promise();
    expect(Item).toBeDefined();
    expect(Item?.data).toEqual(result);
  });

  test('should use DB cached value to avoid a second call', async () => {
    const cachedResult = await getPlanet(url);

    const {Item} = await ddb.get({TableName: TABLE, Key: {cacheKey}}).promise();
    expect(Item?.data).toEqual(cachedResult);
  });
});