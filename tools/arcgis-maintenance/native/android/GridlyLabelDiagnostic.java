package com.gridlygo.gridly.diagnostic;

// Diagnostic fixture source ONLY. Not registered in the production application.
// Compile/integrate only in a separately authorized, exclusive disposable host.
import android.content.Context;
import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.system.Os;
import android.system.OsConstants;
import android.webkit.*;
import java.io.*;
import java.net.*;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.*;

public final class GridlyLabelDiagnostic extends WebViewClient {
    public static final String MODE = "OWNER_ISOLATED_NATIVE_LABEL_DIAGNOSTIC";
    private static final String HOST = "static-map-tiles-api.arcgis.com";
    private static final String TILE = "/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/";
    private static final int MAX_REQUESTS = 2;
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private final File budget;
    private final File flight, stopMarker;
    private final String candidate;
    private final AtomicBoolean inFlight = new AtomicBoolean(false);
    private volatile Socket activeSocket;
    private volatile boolean armed = false, stopped = false;
    private WebView ownedView;
    private volatile String documentOrigin="UNOBSERVABLE";
    private boolean providerEnabled=false;
    private SyntheticResponse synthetic;
    public interface SyntheticResponse { byte[] tile() throws IOException; }
    private final List<Evidence> evidence = new ArrayList<>();
    private final String prefix;

    // Values only, no URL/header/error text. UI origin != HTTP Origin evidence.
    public static final class Evidence {
        public final int request, status;
        public final String documentOrigin, referer, requestOrigin, contentType, tileValidity;
        Evidence(int n, int s, String d, String r, String o, String c, String t) {
            request=n; status=s; documentOrigin=d; referer=r; requestOrigin=o; contentType=c; tileValidity=t;
        }
    }
    private static IOException denied() { return new IOException("DIAGNOSTIC_STOPPED"); }
    private static final class HttpFailure extends IOException {
        final int status;
        HttpFailure(int value) { super("DIAGNOSTIC_HTTP_FAILURE"); status=value; }
    }
    private static File budgetPath(Context context, String run) throws IOException {
        if (!run.matches("owner-[a-f0-9]{32}")) throw denied();
        File base=context.getNoBackupFilesDir().getCanonicalFile();
        File file=new File(base, "arcgis-android-"+run+".ledger");
        if (!file.getCanonicalFile().equals(file.getAbsoluteFile())) throw denied();
        return file;
    }
    // EXPLICIT owner fixture provisioning, never called by constructor/arm/restart.
    public static void provision(Context context, String run, String mode, boolean diagnosticDebugHost) throws IOException {
        if (!MODE.equals(mode) || !diagnosticDebugHost || (context.getApplicationInfo().flags & 2)==0) throw denied();
        File file=budgetPath(context,run);
        if (!file.createNewFile()) throw denied();
        try {
            Os.chmod(file.getPath(),0600);
            try (FileOutputStream stream=new FileOutputStream(file,false)) {
                stream.write(("GRIDLY_LABELS_V1:android:"+run+"\n").getBytes(StandardCharsets.US_ASCII)); stream.getFD().sync();
            }
        } catch (Exception error) { throw denied(); } // Partial provisioning remains invalid; never delete/reset.
    }
    public GridlyLabelDiagnostic(Context context, String run, String mode, boolean diagnosticDebugHost, String candidate) throws IOException {
        if (!MODE.equals(mode) || !diagnosticDebugHost || (context.getApplicationInfo().flags & 2)==0 || candidate==null || !candidate.matches("[A-Za-z0-9_.~-]{16,4096}")) throw denied();
        budget=budgetPath(context,run); this.candidate=candidate;
        flight=new File(budget.getPath()+".flight"); stopMarker=new File(budget.getPath()+".stopped");
        if (flight.exists() || stopMarker.exists()) throw denied();
        prefix="GRIDLY_LABELS_V1:android:"+run+"\n";
        transact(false,false); // Existing ledger mandatory. Never initialize implicitly.
    }
    private synchronized int transact(boolean reserve, boolean stop) throws IOException {
        try {
            if (!stop && stopMarker.exists()) throw denied();
            android.system.StructStat info=Os.lstat(budget.getPath());
            if (!OsConstants.S_ISREG(info.st_mode) || info.st_uid!=android.os.Process.myUid() || (info.st_mode&0777)!=0600 || info.st_nlink!=1) throw denied();
            try (RandomAccessFile file=new RandomAccessFile(budget,"rw"); FileLock lock=file.getChannel().tryLock()) {
                if (lock==null || file.length()>256) throw denied();
                byte[] data=new byte[(int)file.length()]; file.readFully(data);
                String state=new String(data,StandardCharsets.US_ASCII);
                if (!state.startsWith(prefix)) throw denied();
                String tail=state.substring(prefix.length());
                boolean terminal=tail.endsWith("STOP\n");
                if (terminal) tail=tail.substring(0,tail.length()-5);
                int count=tail.equals("")?0:tail.equals("1\n")?1:tail.equals("1\n2\n")?2:-1;
                if (count<0 || terminal || count>=MAX_REQUESTS) throw denied();
                if (stop || reserve) {
                    file.seek(file.length()); file.write((stop?"STOP\n":(count+1)+"\n").getBytes(StandardCharsets.US_ASCII)); file.getFD().sync();
                }
                return reserve?count+1:count;
            }
        } catch (Exception error) { throw denied(); }
    }
    // Exclusive disposable host only: this changes service-worker settings for its process.
    // Never attach after Capacitor Bridge initialization: it has already navigated.
    public void installOnFreshFixture(WebView view) throws IOException {
        if (!(view.getContext() instanceof Activity) || ownedView!=null || view.getUrl()!=null || view.copyBackForwardList().getSize()!=0 || stopped) throw denied();
        ownedView=view;
        Activity owner=(Activity)view.getContext();
        owner.getApplication().registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
            public void onActivityCreated(Activity a,Bundle state) {}
            public void onActivityStarted(Activity a) {}
            public void onActivityResumed(Activity a) {}
            public void onActivityPaused(Activity a) { if (a==owner) stop(); }
            public void onActivityStopped(Activity a) { if (a==owner) stop(); }
            public void onActivitySaveInstanceState(Activity a,Bundle state) {}
            public void onActivityDestroyed(Activity a) { if (a==owner) { stop(); owner.getApplication().unregisterActivityLifecycleCallbacks(this); } }
        });
        WebView.setWebContentsDebuggingEnabled(false);
        view.getSettings().setAllowFileAccess(false); view.getSettings().setAllowContentAccess(false);
        view.getSettings().setJavaScriptEnabled(true); // Only owner-injected DOM operations; no application scripts.
        view.getSettings().setSupportMultipleWindows(false);
        ServiceWorkerController workers=ServiceWorkerController.getInstance();
        workers.getServiceWorkerWebSettings().setBlockNetworkLoads(true);
        workers.setServiceWorkerClient(new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) { return blocked(); }
        });
        view.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) { return true; } // Never forward console text.
        });
        view.setWebViewClient(this);
        view.loadDataWithBaseURL("https://localhost/","<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src https://static-map-tiles-api.arcgis.com\"><body>Gridly isolated label diagnostic</body>","text/html","UTF-8",null);
    }
    // Call on UI thread only, after the blank fixture has committed.
    public void arm(WebView view) throws IOException {
        if ((!providerEnabled && synthetic==null) || ownedView!=view || armed || stopped || flight.exists() || stopMarker.exists() || !"https://localhost".equals(safeOrigin(view.getUrl()))) throw denied();
        documentOrigin=safeOrigin(view.getUrl()); transact(false,false); armed=true;
    }
    public void selectSyntheticTransport(SyntheticResponse responder) throws IOException {
        if (ownedView!=null || armed || stopped || providerEnabled || responder==null || !candidate.startsWith("SYNTHETIC_")) throw denied();
        synthetic=responder;
    }
    // NOT called by fixture construction, installation, arm, navigation or tests.
    // Separate owner live authorization is mandatory before selecting this path.
    public void authorizeProviderTransport(String authorization) throws IOException {
        if (ownedView!=null || armed || stopped || synthetic!=null || candidate.startsWith("SYNTHETIC_") || !"OWNER_TWO_REQUEST_NATIVE_PROVIDER_TEST".equals(authorization)) throw denied();
        providerEnabled=true;
    }
    public void requestTile(int zoom,int row,int column) throws IOException {
        if (!armed || stopped || ownedView==null || zoom<0 || zoom>23 || row<0 || column<0 || row>=(1L<<zoom) || column>=(1L<<zoom)) throw denied();
        String address=new Uri.Builder().scheme("https").authority(HOST).path(TILE+zoom+"/"+row+"/"+column).appendQueryParameter("token",candidate).build().toString();
        // Private process memory only. Never enable console/network trace recording.
        ownedView.evaluateJavascript("(()=>{const i=document.createElement('img');i.src="+org.json.JSONObject.quote(address)+";document.body.appendChild(i)})()",null);
    }
    public void stop() {
        stopped=true; armed=false;
        try { if (activeSocket!=null) activeSocket.close(); } catch (Exception ignored) {}
        try { if (stopMarker.createNewFile()) { try (FileOutputStream stream=new FileOutputStream(stopMarker)) { stream.getFD().sync(); } } } catch (Exception ignored) {}
        try { transact(false,true); } catch (Exception ignored) { /* Invalid/exhausted ledger already denies. */ }
    }
    public synchronized List<Evidence> evidence() { return Collections.unmodifiableList(new ArrayList<>(evidence)); }
    private static String safeOrigin(String text) {
        if (text==null) return "UNOBSERVABLE";
        try { URI uri=new URI(text); if (uri.getUserInfo()!=null) return "UNOBSERVABLE";
            String origin=uri.getScheme()+"://"+uri.getHost()+(uri.getPort()==-1?"":":"+uri.getPort());
            return origin.equals("https://localhost")?origin:"OTHER_ORIGIN";
        } catch (Exception ignored) { return "UNOBSERVABLE"; }
    }
    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
    }
    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        // NEVER return null or delegate remote loads to WebView/Capacitor.
        if (!armed || stopped || !inFlight.compareAndSet(false,true)) return blocked();
        int ordinal=0; boolean flightHeld=false;
        try {
            Uri url=request.getUrl();
            if (!"GET".equals(request.getMethod()) || !"https".equals(url.getScheme()) || !HOST.equals(url.getHost()) || url.getPort()!=-1 || url.getUserInfo()!=null || url.getFragment()!=null ||
                !url.getPath().matches(java.util.regex.Pattern.quote(TILE)+"(?:0|[1-9][0-9]*)/(?:0|[1-9][0-9]*)/(?:0|[1-9][0-9]*)") ||
                !url.getQueryParameterNames().equals(Collections.singleton("token")) || url.getQueryParameters("token").size()!=1) return blocked();
            if (!MessageDigest.isEqual(candidate.getBytes(StandardCharsets.UTF_8),url.getQueryParameter("token").getBytes(StandardCharsets.UTF_8))) { stop(); return blocked(); }
            if (stopMarker.exists() || !flight.createNewFile()) throw denied();
            flightHeld=true;
            Map<String,String> observed=new TreeMap<>(String.CASE_INSENSITIVE_ORDER); observed.putAll(request.getRequestHeaders());
            ordinal=transact(true,false); // fsync before any connection/request write.
            byte[] body=synthetic!=null?synthetic.tile():providerEnabled?sendOnce(url.getEncodedPath()+"?"+url.getEncodedQuery(),observed):null;
            if (body==null || body.length>MAX_BYTES) throw denied();
            Bitmap bitmap=BitmapFactory.decodeByteArray(body,0,body.length);
            if (bitmap==null) throw denied();
            boolean valid=bitmap.getWidth()==512 && bitmap.getHeight()==512; bitmap.recycle();
            if (!valid) throw denied();
            synchronized(this) { evidence.add(new Evidence(ordinal,synthetic==null?200:0,documentOrigin,safeOrigin(observed.get("Referer")),safeOrigin(observed.get("Origin")),"image/png",synthetic==null?"DECODE_512_PASS":"SYNTHETIC_DECODE_512_PASS")); }
            if (ordinal==MAX_REQUESTS) stop();
            return new WebResourceResponse("image/png",null,200,"OK",Collections.emptyMap(),new ByteArrayInputStream(body));
        } catch (Exception error) {
            int status=error instanceof HttpFailure?((HttpFailure)error).status:0;
            synchronized(this) { evidence.add(new Evidence(ordinal,status,"UNOBSERVABLE","UNOBSERVABLE","UNOBSERVABLE","UNEXPECTED","FAIL")); }
            stop(); return blocked();
        } finally { if (flightHeld && !flight.delete()) stop(); inFlight.set(false); }
    }
    @Override public WebResourceResponse shouldInterceptRequest(WebView view, String url) { return blocked(); }
    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { stop(); return true; }
    @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) { stop(); return true; }
    @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) { if (armed) stop(); }
    @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) { stop(); }
    @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) { handler.cancel(); stop(); }

    private byte[] sendOnce(String path, Map<String,String> observed) throws IOException {
        if (stopped || path.indexOf('\r')>=0 || path.indexOf('\n')>=0) throw denied();
        // Raw TLS stream has no HTTP automatic retry/redirect/cache/auth machinery.
        // TCP retransmission is not another application-level HTTP request.
        try (Socket plain=new Socket()) {
            activeSocket=plain; if (stopped) throw denied();
            plain.connect(new InetSocketAddress(HOST,443),8000);
            try (SSLSocket tls=(SSLSocket)((SSLSocketFactory)SSLSocketFactory.getDefault()).createSocket(plain,HOST,443,true)) {
                activeSocket=tls; if (stopped) throw denied();
                tls.setSoTimeout(8000);
                SSLParameters parameters=tls.getSSLParameters(); parameters.setEndpointIdentificationAlgorithm("HTTPS"); tls.setSSLParameters(parameters);
                tls.startHandshake(); // Default platform trust and hostname verification; no custom trust manager.
                StringBuilder message=new StringBuilder("GET ").append(path).append(" HTTP/1.1\r\nHost: ").append(HOST).append("\r\nConnection: close\r\nAccept: image/png\r\nAccept-Encoding: identity\r\n");
                for (String name:Arrays.asList("Referer","Origin","User-Agent")) {
                    String value=observed.get(name);
                    if (value!=null) { if (!value.matches("[\\x20-\\x7e]{1,4096}")) throw denied(); message.append(name).append(": ").append(value).append("\r\n"); }
                }
                byte[] bytes=message.append("\r\n").toString().getBytes(StandardCharsets.US_ASCII);
                if (stopped || stopMarker.exists()) throw denied();
                tls.getOutputStream().write(bytes); // SINGLE_HTTP_WRITE; never retried.
                tls.getOutputStream().flush(); Arrays.fill(bytes,(byte)0);
                ByteArrayOutputStream response=new ByteArrayOutputStream(); byte[] chunk=new byte[8192]; int n;
                while ((n=tls.getInputStream().read(chunk))!=-1) { if (response.size()+n>MAX_BYTES) throw denied(); response.write(chunk,0,n); }
                return parseResponse(response.toByteArray());
            }
        } finally { activeSocket=null; }
    }
    static byte[] parseResponse(byte[] response) throws IOException {
        int end=-1; for (int i=0;i+3<Math.min(response.length,16384);i++) if (response[i]==13&&response[i+1]==10&&response[i+2]==13&&response[i+3]==10) { end=i; break; }
        if (end<0) throw denied();
        String[] lines=new String(response,0,end,StandardCharsets.US_ASCII).split("\r\n");
        if (!lines[0].matches("HTTP/1\\.[01] [1-5][0-9]{2}(?: .*)?")) throw denied();
        int status=Integer.parseInt(lines[0].substring(9,12));
        if (status!=200) throw new HttpFailure(status); // No redirects, auth negotiation or second request.
        Map<String,String> headers=new HashMap<>();
        for (int i=1;i<lines.length;i++) { int colon=lines[i].indexOf(':'); if (colon<1) throw denied(); String key=lines[i].substring(0,colon).toLowerCase(Locale.ROOT); if (headers.put(key,lines[i].substring(colon+1).trim())!=null) throw denied(); }
        byte[] body=Arrays.copyOfRange(response,end+4,response.length);
        if (headers.containsKey("transfer-encoding") || headers.containsKey("content-encoding") || !"image/png".equals(headers.get("content-type")) || !Integer.toString(body.length).equals(headers.get("content-length")) || body.length<8) throw denied();
        byte[] signature={(byte)137,80,78,71,13,10,26,10}; if (!Arrays.equals(signature,Arrays.copyOf(body,8))) throw denied();
        return body; // Unsupported framing fails closed, never retried.
    }
}
