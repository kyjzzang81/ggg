export function NearbyGsScore({ rank }: { rank: number }) {
  const grade = rank <= 1 ? "강력 추천" : rank === 2 ? "추천" : "보통";
  return (
    <div className="home-gs-score nearby-gs-score" aria-hidden="true">
      <span className="home-gs-score__dots">
        {rank <= 1 ? (
          <>
            <span className="home-gs-score__dot home-ggg-dot--blue" />
            <span className="home-gs-score__dot home-ggg-dot--purple" />
            <span className="home-gs-score__dot home-ggg-dot--green" />
          </>
        ) : rank === 2 ? (
          <>
            <span className="home-gs-score__dot home-ggg-dot--purple" />
            <span className="home-gs-score__dot home-ggg-dot--green" />
          </>
        ) : (
          <span className="home-gs-score__dot home-ggg-dot--green" />
        )}
      </span>
      <span className="home-gs-score__label">{grade}</span>
    </div>
  );
}
