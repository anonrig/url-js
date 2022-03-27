const { FAILURE } = require('./constants')
const { percent_decode } = require("./string");

function parse_ipv6(buffer) {
 // TODO: Implement this
}

function parse_opaque_host(buffer) {
 // TODO: Implement this
}

function parse_host(buffer, is_not_url_special = false) {
  // TODO: Implement this
}

module.exports = {
  parse_host,
}
