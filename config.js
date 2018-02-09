const uuid = require('uuid/v4')

// Basic config
const config = {
  domain: process.env.MOA_DOMAIN || 'http://localhost:3000', // url to your app
  tenant_id: process.env.MOA_TENANT_ID || '<your-tenant-id>.onmicrosoft.com', // Your tenant ID
  client_id: process.env.MOA_CLIENT_ID || 'your-client-id', // Application ID in https://portal.azure.com/ -> Azure Active Directory -> App Registrations
  client_secret: process.env.MOA_CLIENT_SECRET || 'your-password' // Registered app in  https://portal.azure.com/ -> Settings -> Keys
}

// Advanced config
module.exports = {
  debug: true,
  domain: config.domain,
  autodiscover_url: 'https://login.microsoftonline.com/' + config.tenant_id + '/.well-known/openid-configuration',
  graph_user_info_url: [
    'https://graph.microsoft.com/v1.0/me'
  //  'https://graph.microsoft.com/v1.0/me/memberOf' additional resources to get from graph. set "graph_user_info_url: false" to disable
  ],
  client_secret: config.client_secret, // Registered app in  https://portal.azure.com/ -> Settings -> Keys
  grant_type: 'authorization_code',
  auth: {
    client_id: config.client_id, // Application ID in https://portal.azure.com/ -> Azure Active Directory -> App Registrations
    response_type: 'code id_token',
    redirect_uri: config.domain + '/api/callback', // Same as configured in azure app registration
    response_mode: 'form_post',
    scope: 'openid',
    state: uuid(),
    nonce: uuid()
  }
}
