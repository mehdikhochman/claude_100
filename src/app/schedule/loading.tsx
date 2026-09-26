// Skeleton shown while the schedule loads.
export default function ScheduleLoading() {
  return (
    <div className="container container--medium" aria-busy="true" aria-label="Loading schedule">
      <div className="page-head">
        <div className="skeleton skeleton--text" style={{ width: "90px", marginBottom: "12px" }} />
        <div className="skeleton skeleton--title" style={{ fontSize: "2.4rem" }} />
        <div className="skeleton skeleton--text mt-4" style={{ width: "80%" }} />
      </div>
      {[0, 1].map((day) => (
        <div key={day} className="day-group">
          <div className="skeleton skeleton--text mb-4" style={{ width: "160px" }} />
          <ul className="list">
            {[0, 1, 2].map((i) => (
              <li key={i} className="item">
                <div className="row" style={{ flexWrap: "nowrap", flex: 1 }}>
                  <div className="skeleton" style={{ width: "56px", height: "28px" }} />
                  <div className="item__main stack--tight">
                    <div className="skeleton skeleton--text" style={{ width: "45%", height: "1.3em" }} />
                    <div className="skeleton skeleton--text" style={{ width: "65%" }} />
                  </div>
                </div>
                <div className="item__aside">
                  <div className="skeleton" style={{ width: "90px", height: "24px", borderRadius: "999px" }} />
                  <div className="skeleton skeleton--btn" style={{ height: "40px", width: "80px" }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
