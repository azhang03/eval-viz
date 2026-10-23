// The explorer frame. The folder walk and the icons come in V1-02 B3.
export function ExplorerStandIn() {
  return (
    <section className="finder" data-area="explorer">
      <div className="tbar">
        <div className="dots"><i style={{ background: "var(--terra)" }} /><i style={{ background: "var(--mustard)" }} /><i style={{ background: "var(--teal)" }} /></div>
        <div className="path">eval</div>
      </div>
      <div className="finder-body">The explorer comes in V1-02 B3.</div>
    </section>
  );
}
