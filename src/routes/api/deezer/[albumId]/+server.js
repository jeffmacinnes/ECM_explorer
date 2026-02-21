export const GET = async ({ params }) => {
	const { albumId } = params;

	try {
		const res = await fetch(`https://api.deezer.com/album/${albumId}/tracks?limit=50`);
		const data = await res.json();

		return new Response(JSON.stringify(data), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch {
		return new Response(JSON.stringify({ error: 'Failed to fetch' }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
