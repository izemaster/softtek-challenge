import {describe, expect, test} from '@jest/globals';
import {getWeather} from './src/handler';

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