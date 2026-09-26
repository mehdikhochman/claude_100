export default function DashboardLoading() {
  return (
    <div className="container" aria-busy="true" aria-label="Loading dashboard">
      <div className="page-head">
        <div className="skeleton skeleton--text" style={{ width: "90px", marginBottom: "12px" }} />
        <div className="skeleton skeleton--title" style={{ fontSize: "2.4rem", width: "50%" }} />
        <div className="skeleton skeleton--text mt-4" style={{ width: "60%" }} />
      </div>
      <div className="grid grid--3">
        <div style={{ gridColumn: "span 2" }}>
          <div className="skeleton skeleton--text mb-4" style={{ width: "140px", height: "1.6em" }} />
          <ul className="list">
            {[0, 1, 2].map((i) => (
              <li key={i} className="item">
                <div className="item__main stack--tight">
                  <div className="skeleton skeleton--text" style={{ width: "40%", height: "1.3em" }} />
                  <div className="skeleton skeleton--text" style={{ width: "70%" }} />
                </div>
                <div className="item__aside">
                  <div className="skeleton" style={{ width: "96px", height: "24px", borderRadius: "999px" }} />
                  <div className="skeleton skeleton--btn" style={{ height: "40px", width: "90px" }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card skeleton" style={{ height: "190px" }} />
      </div>
    </div>
  );
}
