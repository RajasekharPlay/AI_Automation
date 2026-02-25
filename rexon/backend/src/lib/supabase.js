const { createClient } = require('@supabase/supabase-js');
const { fetch: undiciFetch, Agent, setGlobalDispatcher } = require('undici');
const { Resolver } = require('dns').promises;

// ISP (Tata) DNS blocks *.supabase.co — resolve via Google DNS instead
const resolver = new Resolver();
resolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const dnsAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      resolver.resolve4(hostname)
        .then(addrs => {
          if (options && options.all) {
            // undici may request all addresses as [{address, family}]
            callback(null, addrs.map(a => ({ address: a, family: 4 })));
          } else {
            callback(null, addrs[0], 4);
          }
        })
        .catch(() => require('dns').lookup(hostname, options, callback));
    }
  }
});

setGlobalDispatcher(dnsAgent);

// Custom fetch using the DNS-aware undici agent
function customFetch(input, init) {
  return undiciFetch(input, { ...init, dispatcher: dnsAgent });
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  { global: { fetch: customFetch } }
);

module.exports = { supabase };
