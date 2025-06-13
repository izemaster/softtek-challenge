module.exports = {
  tables: [
    {
      TableName: 'API_CACHE_TABLE',
      KeySchema: [{ AttributeName: 'cacheKey', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'cacheKey', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    },
    
  ],
  port: 8000,
};