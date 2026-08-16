// SELECT-only browser-console helper. Uses Gridly's existing authenticated client.
await supabaseClient.from("reports").select("*")
  .eq("report_type", "flooding")
  .gte("lat", 31.5488).lte("lat", 31.5498)
  .gte("lng", -97.1472).lte("lng", -97.1462)
  .order("created_at", { ascending: false }).limit(25);
