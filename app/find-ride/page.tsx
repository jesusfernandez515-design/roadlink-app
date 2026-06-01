export default function FindRidePage() {
  const rides = [
    {
      driver: "John D.",
      rating: "4.9",
      route: "Clarksdale, MS → Danville, AR",
      date: "May 20",
      price: "$45",
      seats: "3 seats left",
    },
    {
      driver: "Sarah M.",
      rating: "4.8",
      route: "Memphis, TN → Little Rock, AR",
      date: "May 21",
      price: "$38",
      seats: "2 seats left",
    },
    {
      driver: "Mike T.",
      rating: "4.7",
      route: "Mobile, AL → Pensacola, FL",
      date: "May 22",
      price: "$25",
      seats: "4 seats left",
    },
  ];

  return (
    <main className="page">
      <section className="searchCard">
        <h1>Find a Ride</h1>

        <input placeholder="Origin" />
        <input placeholder="Destination" />
        <input type="date" />

        <button>Search Rides</button>
      </section>

      <section className="results">
        {rides.map((ride, index) => (
          <div key={index} className="rideCard">
            <div className="topRow">
              <div>
                <h3>{ride.driver}</h3>
                <p>⭐ {ride.rating}</p>
              </div>

              <div className="price">
                {ride.price}
              </div>
            </div>

            <p>{ride.route}</p>
            <p>{ride.date}</p>
            <p>{ride.seats}</p>

            <button className="reserve">
              Reserve Seat
            </button>
          </div>
        ))}
      </section>

      <style>{`
        *{
          box-sizing:border-box;
        }

        .page{
          min-height:100vh;
          background:linear-gradient(135deg,#000,#0f172a,#111827);
          color:white;
          padding:20px;
          font-family:Arial,sans-serif;
        }

        .searchCard{
          max-width:700px;
          margin:0 auto 30px;
          background:#0b0b0b;
          border:1px solid #222;
          border-radius:24px;
          padding:24px;
        }

        h1{
          margin-bottom:20px;
        }

        input{
          width:100%;
          padding:15px;
          margin-bottom:12px;
          border-radius:12px;
          border:1px solid #333;
          background:#111;
          color:white;
        }

        button{
          width:100%;
          padding:16px;
          border:none;
          border-radius:999px;
          background:#22c55e;
          color:white;
          font-weight:700;
        }

        .results{
          max-width:700px;
          margin:0 auto;
        }

        .rideCard{
          background:#0b0b0b;
          border:1px solid #222;
          border-radius:20px;
          padding:20px;
          margin-bottom:16px;
        }

        .topRow{
          display:flex;
          justify-content:space-between;
          align-items:center;
        }

        .price{
          color:#22c55e;
          font-size:24px;
          font-weight:800;
        }

        .reserve{
          margin-top:16px;
        }
      `}</style>
    </main>
  );
}
